/**
 * Sidebar Hover, Touch & Toggle Controller for Equipment by SMO
 * Supports Desktop Hover + Mobile/Tablet Touch and Click gestures
 */
(function() {
    function initSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        const menuBtn = document.getElementById('sidebar-menu-btn');
        const backdrop = document.getElementById('sidebar-backdrop');
        const hoverZone = document.getElementById('sidebar-hover-zone');
        const closeBtn = document.getElementById('sidebar-close-btn');

        if (!sidebar) return;

        let closeTimeout = null;
        let isPinned = false;

        function openSidebar() {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0', 'shadow-2xl');
            if (backdrop) {
                backdrop.classList.remove('opacity-0', 'pointer-events-none');
                backdrop.classList.add('opacity-100', 'pointer-events-auto');
            }
            if (menuBtn) {
                menuBtn.setAttribute('aria-expanded', 'true');
            }
        }

        function closeSidebar(immediate = false) {
            if (isPinned && !immediate) return;
            const delay = immediate ? 0 : 250;
            if (closeTimeout) clearTimeout(closeTimeout);

            closeTimeout = setTimeout(() => {
                sidebar.classList.add('-translate-x-full');
                sidebar.classList.remove('translate-x-0', 'shadow-2xl');
                if (backdrop) {
                    backdrop.classList.add('opacity-0', 'pointer-events-none');
                    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
                }
                if (menuBtn) {
                    menuBtn.setAttribute('aria-expanded', 'false');
                }
                isPinned = false;
            }, delay);
        }

        function cancelClose() {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
        }

        // Click / Touch trigger on Menu Button
        if (menuBtn) {
            menuBtn.addEventListener('mouseenter', () => {
                if (window.innerWidth >= 1024) openSidebar();
            });
            menuBtn.addEventListener('mouseleave', () => {
                if (window.innerWidth >= 1024) closeSidebar(false);
            });
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar.classList.contains('translate-x-0')) {
                    isPinned = false;
                    closeSidebar(true);
                } else {
                    isPinned = true;
                    openSidebar();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isPinned = false;
                closeSidebar(true);
            });
        }

        if (hoverZone) {
            hoverZone.addEventListener('mouseenter', () => {
                if (window.innerWidth >= 1024) openSidebar();
            });
            hoverZone.addEventListener('mouseleave', () => {
                if (window.innerWidth >= 1024) closeSidebar(false);
            });
        }

        sidebar.addEventListener('mouseenter', () => {
            if (window.innerWidth >= 1024) cancelClose();
        });
        sidebar.addEventListener('mouseleave', () => {
            if (window.innerWidth >= 1024) {
                isPinned = false;
                closeSidebar(false);
            }
        });

        if (backdrop) {
            backdrop.addEventListener('click', () => {
                isPinned = false;
                closeSidebar(true);
            });
            backdrop.addEventListener('touchstart', () => {
                isPinned = false;
                closeSidebar(true);
            }, { passive: true });
        }

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                isPinned = false;
                closeSidebar(true);
            }
        });

        // Highlight active page & auto-close on link tap
        const currentPath = window.location.pathname;
        const navLinks = sidebar.querySelectorAll('[data-nav-link]');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (
                (href === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.html') || currentPath.endsWith('index'))) ||
                (href === 'equipment.html' && currentPath.includes('equipment')) ||
                (href === 'calendar.html' && currentPath.includes('calendar')) ||
                (href === 'admin.html' && currentPath.includes('admin'))
            ) {
                link.classList.add('bg-primary', 'text-white', 'shadow-sm');
                link.classList.remove('text-on-surface-variant', 'hover:bg-surface-container-high');
                const icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            }

            // Close on click
            link.addEventListener('click', () => {
                isPinned = false;
                closeSidebar(true);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
