import { handleLogin } from "../Security/loadPrivatekey.js";

 // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
    const loginForm = document.getElementById('loginForm')
    if(loginForm){
    
    loginForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // prevent normal form submission

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/auth/loginwithPassword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            if (result.redirect) {
                 window.location.href = result.redirect; // redirect to pin page
               }else{
            // Login successful - show animation
            await handleLogin(result.userId)
             simulateLogin();
            
            
               }
        } else {
            // Handle error (show message to user)
            alert(result.message || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Something went wrong. Please try again later.');
    }
})
    }

    else{

document.getElementById('pinForm').addEventListener('submit',async function(e){
    e.preventDefault();
    const pin = document.getElementById('pinNumber').value;

    try{

           const response = await fetch('/auth/pinVerify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({pin})
        });

          const result = await response.json();
        //   console.log( 'result',result)

        if (response.ok && result.success) {
            // console.log('result',result)
            
            // Login successful - show animation
            await handleLogin(result.userId)
            simulateLogin();
            

               
        } else {
            // Handle error (show message to user)
            alert(result.message || 'Invalid credentials');
        }


    }catch(err){
        console.error('Login error:', err);
        alert('Something went wrong. Please try again later.');
    }
})

    }

  



    function simulateLogin() {
        const overlay = document.getElementById('transitionOverlay');
        
        // Show overlay
        gsap.to(overlay, {
            opacity: 1,
            duration: 0.5,
            pointerEvents: 'all'
        });
        
        // Logo animation - dramatic entrance
        gsap.to('.transition-logo', {
            scale: 1,
            duration: 0.8,
            ease: 'elastic.out(1, 0.3)',
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
        
        // Create particles explosion from logo
        createParticles();
        
        // Position user avatars
        positionAvatars();
        
        // Animate connections between avatars
        animateConnections();
        
        // Enhanced Chat bubbles animation
        animateChatBubbles();
        
        // Complex logo animation
        const tl = gsap.timeline({repeat: -1});
        tl.to('.transition-logo', {
            rotation: 360,
            duration: 8,
            ease: 'none'
        })
        .to('.transition-logo', {
            y: -20,
            duration: 1,
            yoyo: true,
            repeat: 1,
            ease: 'sine.inOut'
        }, 0);
        
        // Floating background elements
        createFloatingElements();
        
        // Redirect after animation completes
        setTimeout(() => {
            window.location.href = '/chat';
        }, 5000);
    }

    function animateChatBubbles() {
        // Define bubble positions and properties
        const bubbles = [
            { id: 'bubble1', text: 'Welcome back!', delay: 1.2, x: '60%', y: '30%' },
            { id: 'bubble2', text: '3 new messages', delay: 1.5, x: '65%', y: '50%' },
            { id: 'bubble3', text: 'Ready to chat?', delay: 1.8, x: '55%', y: '70%' }
        ];

        // Create and animate each bubble
        bubbles.forEach((bubble, index) => {
            const bubbleEl = document.getElementById(bubble.id);
            
            // Set initial position and style
            gsap.set(bubbleEl, {
                x: bubble.x,
                y: bubble.y,
                opacity: 0,
                scale: 0.5
            });

            // Update bubble text
            bubbleEl.textContent = bubble.text;
            
            // Create a more natural appearing animation
            gsap.to(bubbleEl, {
                opacity: 1,
                scale: 1,
                y: `-=${20 + index * 5}`, // Slightly different bounce heights
                duration: 0.6,
                delay: bubble.delay,
                ease: 'back.out(1.7)',
                onStart: () => {
                    // Add typing indicator effect
                    bubbleEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
                    setTimeout(() => {
                        bubbleEl.innerHTML = bubble.text;
                    }, 500);
                }
            });

            // Add subtle ongoing animation
            gsap.to(bubbleEl, {
                y: `+=${5}`,
                duration: 2,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
                delay: bubble.delay + 0.6
            });
        });

        // Add typing indicator style
        const style = document.createElement('style');
        style.textContent = `
            .typing-indicator {
                display: flex;
                justify-content: center;
                padding: 8px 0;
            }
            .typing-indicator span {
                display: inline-block;
                width: 8px;
                height: 8px;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                margin: 0 2px;
                opacity: 0.4;
            }
            .typing-indicator span:nth-child(1) {
                animation: typing-pulse 1s infinite;
            }
            .typing-indicator span:nth-child(2) {
                animation: typing-pulse 1s infinite 0.2s;
            }
            .typing-indicator span:nth-child(3) {
                animation: typing-pulse 1s infinite 0.4s;
            }
            @keyframes typing-pulse {
                0%, 100% { opacity: 0.4; transform: translateY(0); }
                50% { opacity: 1; transform: translateY(-3px); }
            }
        `;
        document.head.appendChild(style);
    }

    function positionAvatars() {
        const user = document.getElementById('userAvatar');
        const contact1 = document.getElementById('contactAvatar1');
        const contact2 = document.getElementById('contactAvatar2');
        const contact3 = document.getElementById('contactAvatar3');
        
        // Position avatars
        gsap.set(user, {x: '30%', y: '50%', opacity: 0});
        gsap.set(contact1, {x: '50%', y: '30%', opacity: 0});
        gsap.set(contact2, {x: '70%', y: '50%', opacity: 0});
        gsap.set(contact3, {x: '50%', y: '70%', opacity: 0});
        
        // Animate avatars in
        gsap.to(user, {
            opacity: 1,
            duration: 0.8,
            delay: 1.0,
            ease: 'power2.out'
        });
        
        gsap.to(contact1, {
            opacity: 1,
            duration: 0.8,
            delay: 1.2,
            ease: 'power2.out'
        });
        
        gsap.to(contact2, {
            opacity: 1,
            duration: 0.8,
            delay: 1.4,
            ease: 'power2.out'
        });
        
        gsap.to(contact3, {
            opacity: 1,
            duration: 0.8,
            delay: 1.6,
            ease: 'power2.out'
        });
    }

    function animateConnections() {
        const connection1 = document.getElementById('connection1');
        const connection2 = document.getElementById('connection2');
        const connection3 = document.getElementById('connection3');
        
        // Position connections between avatars
        gsap.set(connection1, {
            x: '30%',
            y: '50%',
            width: 0,
            rotation: -30,
            opacity: 0
        });
        
        gsap.set(connection2, {
            x: '30%',
            y: '50%',
            width: 0,
            rotation: 0,
            opacity: 0
        });
        
        gsap.set(connection3, {
            x: '30%',
            y: '50%',
            width: 0,
            rotation: 30,
            opacity: 0
        });
        
        // Animate connections drawing
        gsap.to(connection1, {
            width: 150,
            opacity: 0.7,
            duration: 1,
            delay: 1.8,
            ease: 'power2.out'
        });
        
        gsap.to(connection2, {
            width: 200,
            opacity: 0.7,
            duration: 1,
            delay: 2.0,
            ease: 'power2.out'
        });
        
        gsap.to(connection3, {
            width: 150,
            opacity: 0.7,
            duration: 1,
            delay: 2.2,
            ease: 'power2.out'
        });
        
        // Pulse effect on connections
        gsap.to([connection1, connection2, connection3], {
            opacity: 0.3,
            duration: 1,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            delay: 2.5
        });
    }

    function createParticles() {
        const colors = ['#25D366', '#128C7E', '#34B7F1', '#075E54', '#FFFFFF'];
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.width = `${Math.random() * 10 + 5}px`;
            particle.style.height = particle.style.width;
            document.getElementById('transitionOverlay').appendChild(particle);
            
            // Position particles at center
            gsap.set(particle, {
                x: '50%',
                y: '40%',
                opacity: 0
            });
            
            // Animate particles outward
            gsap.to(particle, {
                x: `${Math.random() * 200 - 100}%`,
                y: `${Math.random() * 200 - 100}%`,
                opacity: 0.7,
                duration: Math.random() * 2 + 1,
                delay: 0.8,
                ease: 'power2.out',
                onComplete: () => {
                    particle.remove();
                }
            });
        }
    }

    function createFloatingElements() {
        const colors = ['#25D366', '#128C7E', '#34B7F1', '#075E54'];
        
        for (let i = 0; i < 12; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            element.style.width = `${Math.random() * 150 + 50}px`;
            element.style.height = element.style.width;
            element.style.background = colors[Math.floor(Math.random() * colors.length)];
            element.style.top = `${Math.random() * 100}%`;
            element.style.left = `${Math.random() * 100}%`;
            element.style.opacity = '0';
            element.style.filter = 'blur(20px)';
            element.style.position = 'absolute';
            element.style.borderRadius = '50%';
            document.body.appendChild(element);
            
            // Animate each element
            gsap.to(element, {
                opacity: 0.1,
                duration: 2,
                delay: Math.random() * 2
            });
            
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
    }
