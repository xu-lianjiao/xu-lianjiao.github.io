document.addEventListener('DOMContentLoaded', () => {
    const animatingElement = document.querySelector('.main-layout, .container');
    if (!animatingElement) return;

    // Toggle Mobile Navigation Menu
    const menuToggle = document.querySelector('.menu-toggle');
    const subpageNav = document.querySelector('.subpage-nav');
    if (menuToggle && subpageNav) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = subpageNav.classList.toggle('menu-open');
            menuToggle.setAttribute('aria-expanded', isOpen);
        });

        // Close menu when clicking outside of the nav bar
        document.addEventListener('click', (e) => {
            if (subpageNav.classList.contains('menu-open') && !subpageNav.contains(e.target)) {
                subpageNav.classList.remove('menu-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip non-navigational links and external/target target links
        if (
            link.target === '_blank' ||
            href.startsWith('#') ||
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            link.hasAttribute('download')
        ) {
            return;
        }

        // Skip external domains
        if (link.hostname !== window.location.hostname) {
            return;
        }

        e.preventDefault();

        animatingElement.classList.add('fade-out-down');

        // Set sessionStorage flag if exiting from index.html so the subpage dock animates
        const isFromIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
        if (isFromIndex) {
            sessionStorage.setItem('navigated_from_index', 'true');
        }

        const isTargetIndex = href.includes('index.html') || new URL(link.href).pathname === '/' || new URL(link.href).pathname.endsWith('/');
        if (isTargetIndex) {
            const dock = document.querySelector('.subpage-nav');
            if (dock) {
                dock.classList.add('dock-fade-out-up');
            }
        }

        setTimeout(() => {
            window.location.href = href;
        }, 600);
    });
});
