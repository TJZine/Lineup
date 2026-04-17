import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';
import {
    createEventBinder,
    createOverlayRuntimePolicyController,
    createPlaybackRuntimeController,
    createPlaybackStartController,
    createProfileSwitchCleanupController,
} from './PriorityOneControllerCollaborators';
import type { OrchestratorEventBinder } from '../OrchestratorEventBinder';
import type { OverlayRuntimePolicyController } from '../OverlayRuntimePolicyController';
import type { ProfileSwitchCleanupController } from '../ProfileSwitchCleanupController';
import type { PlaybackRuntimeController } from './PlaybackRuntimeController';
import type { PlaybackStartController } from './PlaybackStartController';

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
    const playbackStartController = createPlaybackStartController(input);
    const playbackRuntimeController = createPlaybackRuntimeController(input);
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
