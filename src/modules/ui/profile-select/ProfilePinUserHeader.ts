import type { PlexHomeUser } from '../../plex/auth';

export const renderProfilePinUserHeader = (container: HTMLElement, user: PlexHomeUser): void => {
    container.replaceChildren();

    const avatar = document.createElement('div');
    avatar.className = 'profile-pin-avatar';
    const fallbackInitial = user.title.slice(0, 1).toUpperCase();

    if (user.thumb) {
        const img = document.createElement('img');
        img.src = user.thumb;
        img.alt = `${user.title} avatar`;
        img.loading = 'eager';
        img.addEventListener('error', () => {
            img.remove();
            avatar.classList.add('profile-pin-avatar-fallback');
            avatar.textContent = fallbackInitial;
        });
        avatar.appendChild(img);
    } else {
        avatar.classList.add('profile-pin-avatar-fallback');
        avatar.textContent = fallbackInitial;
    }

    container.appendChild(avatar);
};
