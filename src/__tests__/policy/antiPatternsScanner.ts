import ts from 'typescript';

export type PrivateProbe = {
    file: string;
    line: number;
    column: number;
    receiver: string;
    property: string;
    snippet: string;
};

export type SleepProbe = {
    file: string;
    line: number;
    column: number;
    kind: 'timer-call' | 'await-wait' | 'promise-timeout';
    snippet: string;
};

const stripParens = (node: ts.Expression): ts.Expression => {
    let current = node;
    while (ts.isParenthesizedExpression(current)) {
        current = current.expression;
    }
    return current;
};

const isGlobalReceiver = (expr: ts.Expression): boolean => {
    const root = stripParens(expr);
    return ts.isIdentifier(root) && (root.text === 'globalThis' || root.text === 'window' || root.text === 'global');
};

const isTimerCallee = (expr: ts.Expression): boolean => {
    if (ts.isIdentifier(expr)) {
        return expr.text === 'setTimeout' || expr.text === 'setInterval';
    }
    if (ts.isPropertyAccessExpression(expr)) {
        const name = expr.name.text;
        if (name !== 'setTimeout' && name !== 'setInterval') return false;
        return isGlobalReceiver(expr.expression);
    }
    if (
        ts.isElementAccessExpression(expr)
        && ts.isStringLiteral(expr.argumentExpression)
        && (expr.argumentExpression.text === 'setTimeout' || expr.argumentExpression.text === 'setInterval')
    ) {
        return isGlobalReceiver(expr.expression);
    }
    return false;
};

const getAssertionInfo = (node: ts.Expression): { suspicious: boolean; root: ts.Expression } => {
    let current = stripParens(node);
    let sawAny = false;
    let sawUnknown = false;
    let assertionDepth = 0;

    while (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
        assertionDepth += 1;
        const typeNode = current.type;
        if (typeNode.kind === ts.SyntaxKind.AnyKeyword) {
            sawAny = true;
        }
        if (typeNode.kind === ts.SyntaxKind.UnknownKeyword) {
            sawUnknown = true;
        }
        current = stripParens(current.expression);
    }

    return {
        suspicious: sawAny || (sawUnknown && assertionDepth >= 2),
        root: current,
    };
};

const containsTimerCall = (node: ts.Node): boolean => {
    let found = false;
    const visit = (next: ts.Node): void => {
        if (found) return;
        if (ts.isCallExpression(next) && isTimerCallee(next.expression)) {
            found = true;
            return;
        }
        ts.forEachChild(next, visit);
    };
    visit(node);
    return found;
};

const getLineColumn = (sourceFile: ts.SourceFile, node: ts.Node): { line: number; column: number } => {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { line: start.line + 1, column: start.character + 1 };
};

const getSnippet = (sourceFile: ts.SourceFile, node: ts.Node): string => {
    return sourceFile.text
        .slice(node.getStart(sourceFile), node.getEnd())
        .replace(/\s+/g, ' ')
        .trim();
};

const inferScriptKind = (file: string): ts.ScriptKind => {
    const lower = file.toLowerCase();
    if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX;
    if (lower.endsWith('.ts')) return ts.ScriptKind.TS;
    if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
    if (lower.endsWith('.js')) return ts.ScriptKind.JS;
    if (lower.endsWith('.mts') || lower.endsWith('.cts')) return ts.ScriptKind.TS;
    if (lower.endsWith('.mjs') || lower.endsWith('.cjs')) return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
};

export const scanSourceText = (
    args: { file: string; sourceText: string }
): { privateProbes: PrivateProbe[]; sleepProbes: SleepProbe[] } => {
    const sourceFile = ts.createSourceFile(
        args.file,
        args.sourceText,
        ts.ScriptTarget.Latest,
        true,
        inferScriptKind(args.file)
    );
    // TypeScript does not expose `parseDiagnostics` on SourceFile via the public API surface.
    // We use this internal field as a best-effort guardrail; tests assert that broken source throws.
    const parseDiagnostics =
        (sourceFile as unknown as { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
    if (parseDiagnostics.length > 0) {
        const [diagnostic] = parseDiagnostics;
        const message = diagnostic
            ? ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
            : 'Unknown parse error';
        const location = diagnostic && typeof diagnostic.start === 'number'
            ? ((): string => {
                const start = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
                return `:${start.line + 1}:${start.character + 1}`;
            })()
            : '';
        throw new Error(`Failed to parse ${args.file}${location}: ${message}`);
    }

    const assertedAliases = new Set<string>();
    const waitWrappers = new Set<string>();
    const privateProbes: PrivateProbe[] = [];
    const sleepProbes: SleepProbe[] = [];
    const privateProbeKeys = new Set<string>();
    const sleepProbeKeys = new Set<string>();

    const registerProbe = (probe: PrivateProbe): void => {
        const key = [probe.file, probe.line, probe.column, probe.receiver, probe.property].join('\0');
        if (privateProbeKeys.has(key)) return;
        privateProbeKeys.add(key);
        privateProbes.push(probe);
    };

    const registerSleep = (probe: SleepProbe): void => {
        const key = [probe.file, probe.line, probe.column, probe.kind].join('\0');
        if (sleepProbeKeys.has(key)) return;
        sleepProbeKeys.add(key);
        sleepProbes.push(probe);
    };

    const discoverWrappers = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) && node.name && node.body && containsTimerCall(node.body)) {
            waitWrappers.add(node.name.text);
        }

        if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
            && node.initializer.body
            && containsTimerCall(node.initializer.body)
        ) {
            waitWrappers.add(node.name.text);
        }

        ts.forEachChild(node, discoverWrappers);
    };
    discoverWrappers(sourceFile);

    const visit = (node: ts.Node): void => {
        const tryRegisterPrivateProbe = (
            next: ts.Node,
            receiverExpr: ts.Expression,
            propertyName: string,
        ): void => {
            if (!propertyName.startsWith('_')) return;
            const receiverExpression = stripParens(receiverExpr);
            const receiverInfo = getAssertionInfo(receiverExpression);
            const isAliasReceiver = ts.isIdentifier(receiverInfo.root) && assertedAliases.has(receiverInfo.root.text);
            if (!receiverInfo.suspicious && !isAliasReceiver) return;
            const { line, column } = getLineColumn(sourceFile, next);
            registerProbe({
                file: args.file,
                line,
                column,
                receiver: receiverInfo.root.getText(sourceFile),
                property: propertyName,
                snippet: getSnippet(sourceFile, next),
            });
        };

        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            if (node.type && (node.type.kind === ts.SyntaxKind.AnyKeyword || node.type.kind === ts.SyntaxKind.UnknownKeyword)) {
                assertedAliases.add(node.name.text);
            }

            if (node.initializer) {
                const assertionInfo = getAssertionInfo(node.initializer);
                if (assertionInfo.suspicious) {
                    assertedAliases.add(node.name.text);
                }
            }
        }

        if (ts.isPropertyAccessExpression(node)) {
            tryRegisterPrivateProbe(node, node.expression, node.name.text);
        }

        if (
            ts.isElementAccessExpression(node)
            && ts.isStringLiteral(node.argumentExpression)
        ) {
            tryRegisterPrivateProbe(node, node.expression, node.argumentExpression.text);
        }

        if (ts.isCallExpression(node) && isTimerCallee(node.expression)) {
            const { line, column } = getLineColumn(sourceFile, node);
            registerSleep({
                file: args.file,
                line,
                column,
                kind: 'timer-call',
                snippet: getSnippet(sourceFile, node),
            });
        }

        if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
            const callee = node.expression.expression.text;
            if (waitWrappers.has(callee)) {
                const { line, column } = getLineColumn(sourceFile, node);
                registerSleep({
                    file: args.file,
                    line,
                    column,
                    kind: 'await-wait',
                    snippet: getSnippet(sourceFile, node),
                });
            }
        }

        if (ts.isAwaitExpression(node) && ts.isNewExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
            if (node.expression.expression.text === 'Promise') {
                const [executor] = node.expression.arguments ?? [];
                if (executor && (ts.isArrowFunction(executor) || ts.isFunctionExpression(executor)) && containsTimerCall(executor.body)) {
                    const { line, column } = getLineColumn(sourceFile, node);
                    registerSleep({
                        file: args.file,
                        line,
                        column,
                        kind: 'promise-timeout',
                        snippet: getSnippet(sourceFile, node),
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return { privateProbes, sleepProbes };
};

export const sortPrivateProbes = (probes: PrivateProbe[]): PrivateProbe[] => {
    return [...probes].sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        if (a.line !== b.line) return a.line - b.line;
        if (a.column !== b.column) return a.column - b.column;
        if (a.receiver !== b.receiver) return a.receiver.localeCompare(b.receiver);
        if (a.property !== b.property) return a.property.localeCompare(b.property);
        return a.snippet.localeCompare(b.snippet);
    });
};

export const sortSleepProbes = (probes: SleepProbe[]): SleepProbe[] => {
    return [...probes].sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        if (a.line !== b.line) return a.line - b.line;
        if (a.column !== b.column) return a.column - b.column;
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.snippet.localeCompare(b.snippet);
    });
};
