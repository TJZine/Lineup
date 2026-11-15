import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';
import {
    createEventBinder,
    createOverlayRuntimePolicyController,
    createPlaybackRuntimeController,
    createPlaybackStartController,
    createProfileSwitchCleanupController,
} from './PriorityOneControllerCollaborators';
import type { OrchestratorEventBinder } from '../events/OrchestratorEventBinder';
import type { OverlayRuntimePolicyController } from '../controllers/OverlayRuntimePolicyController';
import type { ProfileSwitchCleanupController } from '../controllers/ProfileSwitchCleanupController';
import type { PlaybackRuntimeController } from './PlaybackRuntimeController';
import type { PlaybackStartController } from './PlaybackStartController';

export type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';

export interface PriorityOneControllersAndBinder {
    overlayRuntimePolicyController: OverlayRuntimePolicyController;
    playbackStartController: PlaybackStartController;
    playbackRuntimeController: PlaybackRuntimeController;
    profileSwitchCleanupController: ProfileSwitchCleanupController;
    eventBinder: OrchestratorEventBinder;
}

export function createPriorityOneControllersAndBinder(
    input: PriorityOneAssemblyInput
): PriorityOneControllersAndBinder {
    const overlayRuntimePolicyController = createOverlayRuntimePolicyController(input);
    let playbackStartController: PlaybackStartController | null = null;
    const playbackRuntimeController = createPlaybackRuntimeController(input, () => {
        const program = input.modules.scheduler.getCurrentProgram();
        if (!program || !playbackStartController) return null;
        return playbackRuntimeController.trackProgramStart(
            playbackStartController.handleProgramStart(program)
        );
    });
    playbackStartController = createPlaybackStartController(input, playbackRuntimeController);
    const profileSwitchCleanupController = createProfileSwitchCleanupController(input);
    const eventBinder = createEventBinder(
        input,
        playbackStartController,
        playbackRuntimeController
    );

    return {
        overlayRuntimePolicyController,
        playbackStartController,
        playbackRuntimeController,
        profileSwitchCleanupController,
        eventBinder,
    };
}
