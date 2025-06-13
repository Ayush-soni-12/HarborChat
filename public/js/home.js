 gsap.registerPlugin(ScrollTrigger);
        
        // Hero section animations
        gsap.from(".navbar", {
            duration: 1,
            y: -50,
            opacity: 0,
            ease: "power3.out"
        });
        
        gsap.from(".hero-content h1", {
            duration: 1,
            x: -50,
            opacity: 0,
            delay: 0.3,
            ease: "back.out(1.7)"
        });
        
        gsap.from(".hero-content p", {
            duration: 1,
            x: -50,
            opacity: 0,
            delay: 0.6,
            ease: "power2.out"
        });
        
        gsap.from(".btn-group", {
            duration: 1,
            y: 50,
            opacity: 0,
            delay: 0.9,
            ease: "power2.out"
        });
        
        gsap.from("#hero-img", {
            duration: 1.5,
            x: 100,
            opacity: 0,
            delay: 0.6,
            ease: "elastic.out(1, 0.5)"
        });
        
        // Floating elements animation
        gsap.to(".floating-element:nth-child(1)", {
            duration: 15,
            x: 100,
            y: 50,
            rotation: 360,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
        
        gsap.to(".floating-element:nth-child(2)", {
            duration: 20,
            x: -50,
            y: -30,
            rotation: -360,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
        
        gsap.to(".floating-element:nth-child(3)", {
            duration: 25,
            x: 70,
            y: 70,
            rotation: 180,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
        
        // Chat bubbles animation
        gsap.to(".chat-bubble:nth-child(1)", {
            duration: 0.5,
            opacity: 1,
            delay: 1.5,
            y: -20,
            ease: "back.out(1.7)"
        });
        
        gsap.to(".chat-bubble:nth-child(2)", {
            duration: 0.5,
            opacity: 1,
            delay: 2.5,
            y: -15,
            ease: "back.out(1.7)"
        });
        
        gsap.to(".chat-bubble:nth-child(3)", {
            duration: 0.5,
            opacity: 1,
            delay: 3.5,
            y: -10,
            ease: "back.out(1.7)"
        });
        
        // Feature cards animation with ScrollTrigger
        gsap.utils.toArray(".feature-card").forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: "top 80%",
                    toggleActions: "play none none none"
                },
                y: 50,
                opacity: 0,
                duration: 0.8,
                delay: i * 0.1,
                ease: "back.out(1.7)"
            });
        });
        
        // Wave background animation
        gsap.to(".wave-bg", {
            backgroundPositionX: "1200px",
            duration: 60,
            repeat: -1,
            ease: "none"
        });
        
        // Text gradient animation
        const textGradient = document.querySelectorAll('.text-gradient');
        let hue = 120; // Start with green hue
        
        function updateGradient() {
            hue = (hue + 0.5) % 360;
            const color1 = `hsl(${hue}, 80%, 50%)`;
            const color2 = `hsl(${(hue + 60) % 360}, 80%, 50%)`;
            
            textGradient.forEach(el => {
                el.style.background = `linear-gradient(90deg, ${color1}, ${color2})`;
                el.style.webkitBackgroundClip = 'text';
                el.style.backgroundClip = 'text';
            });
            
            requestAnimationFrame(updateGradient);
        }
        
        updateGradient();
        
        // Mobile menu toggle (for smaller screens)
        document.addEventListener('DOMContentLoaded', function() {
            const mobileMenuBtn = document.createElement('button');
            mobileMenuBtn.innerHTML = '☰';
            mobileMenuBtn.style.background = 'transparent';
            mobileMenuBtn.style.border = 'none';
            mobileMenuBtn.style.color = 'var(--dark)';
            mobileMenuBtn.style.fontSize = '1.5rem';
            mobileMenuBtn.style.cursor = 'pointer';
            mobileMenuBtn.style.display = 'none';
            mobileMenuBtn.style.marginLeft = 'auto';
            
            const nav = document.querySelector('.navbar');
            nav.insertBefore(mobileMenuBtn, nav.lastElementChild);
            
            function toggleMenu() {
                const navLinks = document.querySelector('.nav-links');
                navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            }
            
            mobileMenuBtn.addEventListener('click', toggleMenu);
            
            function checkScreenSize() {
                if (window.innerWidth <= 768) {
                    mobileMenuBtn.style.display = 'block';
                    document.querySelector('.nav-links').style.display = 'none';
                } else {
                    mobileMenuBtn.style.display = 'none';
                    document.querySelector('.nav-links').style.display = 'flex';
                }
            }
            
            window.addEventListener('resize', checkScreenSize);
            checkScreenSize();
        });