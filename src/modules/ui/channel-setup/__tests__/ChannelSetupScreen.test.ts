/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { AppOrchestrator } from '../../../../Orchestrator';

const makeScreen = (): { container: HTMLElement; screen: ChannelSetupScreen } => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orchestrator = {
        getNavigation: () => null,
    } as unknown as AppOrchestrator;
    const screen = new ChannelSetupScreen(container, orchestrator);
    return { container, screen };
};

describe('ChannelSetupScreen', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders a loading placeholder while setup record is not applied', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _recordApplied: boolean;
            _review: unknown;
            _isReviewLoading: boolean;
            _reviewError: string | null;
            _loadReview: jest.Mock;
            _renderBuildReview: () => void;
        };

        screenAny._recordApplied = false;
        screenAny._review = null;
        screenAny._isReviewLoading = false;
        screenAny._reviewError = null;
        screenAny._loadReview = jest.fn().mockResolvedValue(undefined);

        screenAny._renderBuildReview();

        const loading = container.querySelector('.setup-preview-loading') as HTMLElement | null;
        expect(loading?.textContent).toContain('Preparing your review');
        expect(screenAny._loadReview).not.toHaveBeenCalled();
    });

    it('loads review once the setup record is applied', () => {
        const { screen } = makeScreen();
        const screenAny = screen as unknown as {
            _recordApplied: boolean;
            _review: unknown;
            _isReviewLoading: boolean;
            _reviewError: string | null;
            _loadReview: jest.Mock;
            _renderBuildReview: () => void;
        };

        screenAny._recordApplied = true;
        screenAny._review = null;
        screenAny._isReviewLoading = false;
        screenAny._reviewError = null;
        screenAny._loadReview = jest.fn().mockResolvedValue(undefined);

        screenAny._renderBuildReview();

        expect(screenAny._loadReview).toHaveBeenCalled();
    });
});
