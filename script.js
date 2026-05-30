document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Dynamic Navbar Scroll Effect
    const navbarContainer = document.querySelector('.navbar-container');
    const scrollThreshold = 50;

    function handleNavbarScroll() {
        if (window.scrollY > scrollThreshold) {
            navbarContainer.classList.add('scrolled');
        } else {
            navbarContainer.classList.remove('scrolled');
        }
    }
    
    window.addEventListener('scroll', handleNavbarScroll);
    handleNavbarScroll(); // Run once on load to check starting scroll depth

    // 2. Mobile Hamburger Menu Toggle
    const navToggle = document.getElementById('js-nav-toggle');
    const navMenu = document.getElementById('js-nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('open');
            navToggle.classList.toggle('active');
            
            // Lock body scroll when mobile drawer is open
            if (navMenu.classList.contains('open')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        // Close drawer when individual navigation links are clicked
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // If clicking Services toggle on mobile, open dropdown instead of closing drawer
                if (link.classList.contains('dropdown-toggle') && window.innerWidth <= 992) {
                    e.preventDefault();
                    const megaMenu = link.nextElementSibling;
                    if (megaMenu) {
                        megaMenu.classList.toggle('show');
                        link.classList.toggle('active-dropdown');
                    }
                    return;
                }
                
                navMenu.classList.remove('open');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            });
        });

        // Close mobile drawer and dropdown when clicking sub-menu items
        const megaMenuItems = document.querySelectorAll('.mega-menu-item');
        megaMenuItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('href');
                if (targetId && targetId.startsWith('#') && targetId !== '#upload-modal') {
                    if (window.innerWidth <= 992) {
                        navMenu.classList.remove('open');
                        navToggle.classList.remove('active');
                        document.body.style.overflow = '';
                        const servicesDropdown = document.querySelector('.mega-menu');
                        if (servicesDropdown) {
                            servicesDropdown.classList.remove('show');
                        }
                    }
                }
            });
        });
    }

    // 3. ScrollSpy: Highlight Active Link on Scroll
    const sections = [];
    navLinks.forEach(link => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
            const section = document.querySelector(targetId);
            if (section) {
                sections.push({ link, section });
            }
        }
    });

    function scrollSpy() {
        const isAtBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 10;
        if (isAtBottom && sections.length > 0) {
            navLinks.forEach(l => l.classList.remove('active'));
            sections[sections.length - 1].link.classList.add('active');
            return;
        }

        const scrollPosition = window.scrollY + window.innerHeight / 3;

        sections.forEach(({ link, section }) => {
            const rect = section.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const height = rect.height;

            if (scrollPosition >= top && scrollPosition < top + height) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', scrollSpy);
    scrollSpy(); // Run once on load to highlight active section

    // 4. Parallax Background Hover (Desktop only)
    const heroBg = document.querySelector('.hero-bg');
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (heroBg && !isTouchDevice) {
        window.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;
            
            const moveX = (clientX / innerWidth) - 0.5;
            const moveY = (clientY / innerHeight) - 0.5;
            
            const translateX = moveX * -15; 
            const translateY = moveY * -15;
            
            heroBg.style.transform = `scale(1.05) translate(${translateX}px, ${translateY}px)`;
        });
    }

    // 5. Contact Form Submission Handling
    const contactForm = document.getElementById('js-contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const service = document.getElementById('service').value;

            console.log('Inquiry submitted:', { name, email, phone, service });
            
            // Show premium success toast
            showNotification(`Thank you, ${name}! Your inquiry has been sent to Sajjad Pasha.`);
            
            // Reset form
            contactForm.reset();
        });
    }

    // Toast Notification System
    function showNotification(message) {
        const existingToast = document.querySelector('.cea-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'cea-toast';
        toast.textContent = message;
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '3rem',
            left: '50%',
            transform: 'translateX(-50%) translateY(20px)',
            background: 'rgba(212, 175, 55, 0.95)',
            color: '#07090e',
            padding: '1.25rem 2.5rem',
            borderRadius: '30px',
            fontSize: '0.95rem',
            fontWeight: '600',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.5px',
            boxShadow: '0 15px 40px rgba(212, 175, 55, 0.3)',
            zIndex: '10000',
            opacity: '0',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 4000);
    }

    // 6. Upload Property Modal Controls
    const uploadModal = document.getElementById('js-upload-modal');
    const modalCloseBtn = document.getElementById('js-modal-close');
    const uploadTriggers = document.querySelectorAll('.trigger-upload');
    const uploadForm = document.getElementById('js-upload-form');
    
    let uploadedFilesList = [];

    function openUploadModal(e) {
        if (e) e.preventDefault();
        if (uploadModal) {
            uploadModal.classList.add('open');
            uploadModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            
            // Also close mobile drawer if open
            if (navMenu && navMenu.classList.contains('open')) {
                navMenu.classList.remove('open');
                if (navToggle) navToggle.classList.remove('active');
                const servicesDropdown = document.querySelector('.mega-menu');
                if (servicesDropdown) {
                    servicesDropdown.classList.remove('show');
                }
            }
        }
    }

    function closeUploadModal() {
        if (uploadModal) {
            uploadModal.classList.remove('open');
            uploadModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (uploadForm) uploadForm.reset();
            uploadedFilesList = [];
            renderFilePreviews();
        }
    }

    uploadTriggers.forEach(trigger => {
        trigger.addEventListener('click', openUploadModal);
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeUploadModal);
    }

    if (uploadModal) {
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                closeUploadModal();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && uploadModal && uploadModal.classList.contains('open')) {
            closeUploadModal();
        }
    });

    // Drag and Drop Zone Interaction
    const dragDropArea = document.getElementById('js-drag-drop-area');
    const fileInput = document.getElementById('uploader-files');
    const filePreviewGrid = document.getElementById('js-file-preview-grid');

    if (dragDropArea && fileInput) {
        dragDropArea.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                dragDropArea.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                dragDropArea.classList.remove('drag-over');
            }, false);
        });

        dragDropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleUploadedFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            handleUploadedFiles(files);
        });
    }

    function handleUploadedFiles(files) {
        const maxFiles = 5;
        
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                showNotification("Only image files are allowed.");
                return;
            }
            if (uploadedFilesList.length >= maxFiles) {
                showNotification("You can upload a maximum of 5 images.");
                return;
            }
            
            const isDuplicate = uploadedFilesList.some(f => f.name === file.name && f.size === file.size);
            if (!isDuplicate) {
                uploadedFilesList.push(file);
            }
        });
        
        renderFilePreviews();
        if (fileInput) fileInput.value = '';
    }

    function renderFilePreviews() {
        if (!filePreviewGrid) return;
        filePreviewGrid.innerHTML = '';

        uploadedFilesList.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';

            const img = document.createElement('img');
            img.alt = file.name;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'file-preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove file ${file.name}`);
            
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                uploadedFilesList.splice(index, 1);
                renderFilePreviews();
            });

            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            filePreviewGrid.appendChild(previewItem);
        });
    }

    // Modal Form Submission
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('uploader-name').value;
            const propName = document.getElementById('property-name').value;

            console.log('Property Upload submitted for:', propName);

            // Show custom gold toast success notification
            showNotification(`Thank you, ${name}! Your property '${propName}' has been uploaded successfully for review.`);

            closeUploadModal();
        });
    }

    // Console Branding
    console.log(
        '%cCorporate Estate Avenue%c\nPremium Property Management & Real Estate Consulting', 
        'color: #d4af37; font-size: 20px; font-weight: bold; font-family: sans-serif;',
        'color: #a1a1aa; font-size: 14px; font-family: sans-serif;'
    );
});
