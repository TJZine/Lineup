import { readFallbackAbortSignalReason } from '../utils/abortSignalReason';

type ReplaceChildrenMethod = Element['replaceChildren'];
type ThrowIfAbortedMethod = AbortSignal['throwIfAborted'];
type ElementGetAttribute = (this: Element, qualifiedName: string) => string | null;
type NodeContains = (this: Node, other: Node | null) => boolean;
type NativeAbortSignalGetter = () => unknown;
type OptionalNativeAbortSignalGetter = NativeAbortSignalGetter | undefined;

const nativeElementGetAttribute: ElementGetAttribute | null =
    typeof Element === 'undefined' ? null : Element.prototype.getAttribute;
const nativeNodeContains: NodeContains | null =
    typeof Node === 'undefined' ? null : Node.prototype.contains;

/** Install the DOM and abort APIs used by Lineup but absent from the webOS 6 engine. */
export function installRequiredWebApis(): void {
    if (typeof Element !== 'undefined' && typeof Element.prototype.replaceChildren !== 'function') {
        Object.defineProperty(Element.prototype, 'replaceChildren', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: replaceChildrenFallback,
        });
    }

    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.prototype.throwIfAborted !== 'function') {
        const abortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
        if (!abortedGetter) {
            throw new Error('AbortSignal.aborted getter is unavailable');
        }
        const reasonGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'reason')?.get;

        Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: createThrowIfAbortedFallback(abortedGetter, reasonGetter),
        });
    }
}

const replaceChildrenFallback: ReplaceChildrenMethod = function replaceChildrenFallback(
    this: Element,
    ...nodes: (Node | string)[]
): void {
    if (!nativeElementGetAttribute) {
        throw new TypeError('Element.replaceChildren receiver is not an Element');
    }
    nativeElementGetAttribute.call(this, 'id');

    const ownerDocument = this.ownerDocument;

    // Validate every node before moving any of them. In particular, appending an
    // ancestor to a fragment first would detach this element before detecting a cycle.
    for (const node of nodes) {
        if (typeof node === 'string') continue;
        validateReplacementNode(this, node);
    }

    const replacement = ownerDocument.createDocumentFragment();
    for (const node of nodes) {
        replacement.appendChild(
            typeof node === 'string' ? ownerDocument.createTextNode(node) : node
        );
    }

    while (this.firstChild) {
        this.removeChild(this.firstChild);
    }
    this.appendChild(replacement);
};

function validateReplacementNode(parent: Element, node: Node): void {
    // Calling the platform method also performs a native Node brand check while
    // supporting nodes from another document or realm.
    if (!nativeNodeContains) {
        throw new TypeError('DOM Node APIs are unavailable');
    }
    nativeNodeContains.call(node, node);

    switch (node.nodeType) {
        case Node.ELEMENT_NODE:
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
        case Node.PROCESSING_INSTRUCTION_NODE:
        case Node.COMMENT_NODE:
        case Node.DOCUMENT_FRAGMENT_NODE:
            break;
        default:
            throw createHierarchyRequestError();
    }

    if (nativeNodeContains.call(node, parent)) {
        throw createHierarchyRequestError();
    }
}

function createHierarchyRequestError(): DOMException {
    return new DOMException('The operation would yield an incorrect node tree.', 'HierarchyRequestError');
}

function createThrowIfAbortedFallback(
    abortedGetter: NativeAbortSignalGetter,
    reasonGetter: OptionalNativeAbortSignalGetter
): ThrowIfAbortedMethod {
    return function throwIfAbortedFallback(this: AbortSignal): void {
        const abortedValue: unknown = abortedGetter.call(this);
        if (typeof abortedValue !== 'boolean') {
            throw new TypeError('AbortSignal.aborted getter returned an invalid value');
        }
        if (!abortedValue) return;

        if (reasonGetter) {
            const reason: unknown = reasonGetter.call(this);
            if (reason !== undefined) {
                throw reason;
            }
        }

        throw readFallbackAbortSignalReason(this);
    };
}
