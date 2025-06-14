 document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault(); // prevent normal form submission
    const name = document.getElementById('name').value;
    const phoneNo = document.getElementById('phoneNo').value
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name,phoneNo,email, password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Login successful - show animation
            simulateSignup();
        } else {
            // Handle error (show message to user)
            alert(result.message || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Something went wrong. Please try again later.');
    }
        });

        function simulateSignup() {
            const overlay = document.getElementById('transitionOverlay');
            
            // Show overlay
            gsap.to(overlay, {
                opacity: 1,
                duration: 0.5,
                pointerEvents: 'all'
            });
            
            // Logo animation
            gsap.to('.transition-logo', {
                scale: 1,
                duration: 0.8,
                ease: 'elastic.out(1, 0.5)',
                delay: 0.3
            });
            
            // Message animation
            gsap.to('.transition-message', {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'back.out(1.7)',
                delay: 0.8
            });
            
            // Chat bubbles animation
            gsap.to('.chat-bubble:nth-child(1)', {
                opacity: 1,
                y: -20,
                duration: 0.6,
                ease: 'back.out(1.7)',
                delay: 1.2
            });
            
            gsap.to('.chat-bubble:nth-child(2)', {
                opacity: 1,
                y: -15,
                duration: 0.6,
                ease: 'back.out(1.7)',
                delay: 1.5
            });
            
            gsap.to('.chat-bubble:nth-child(3)', {
                opacity: 1,
                y: -10,
                duration: 0.6,
                ease: 'back.out(1.7)',
                delay: 1.8
            });
            
            // Pulse animation
            gsap.to('.transition-logo', {
                scale: 1.1,
                duration: 0.8,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
                delay: 2
            });
            
            // Redirect after animation completes
            setTimeout(() => {
                window.location.href = '/chat'; // Change to your actual home page URL
            }, 3500);
        }

        // Add some floating elements in the background
        const colors = ['#25D366', '#128C7E', '#34B7F1', '#075E54'];
        for (let i = 0; i < 8; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            element.style.width = `${Math.random() * 100 + 50}px`;
            element.style.height = element.style.width;
            element.style.background = colors[Math.floor(Math.random() * colors.length)];
            element.style.top = `${Math.random() * 100}%`;
            element.style.left = `${Math.random() * 100}%`;
            element.style.opacity = '0.1';
            element.style.filter = 'blur(20px)';
            element.style.position = 'absolute';
            element.style.borderRadius = '50%';
            document.body.appendChild(element);
            
            // Animate each element
            gsap.to(element, {
                x: `${Math.random() * 200 - 100}px`,
                y: `${Math.random() * 200 - 100}px`,
                rotation: Math.random() * 360,
                duration: Math.random() * 20 + 10,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            });
        }