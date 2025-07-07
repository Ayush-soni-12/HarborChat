 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
            import {
                getAuth,
                RecaptchaVerifier,
                signInWithPhoneNumber,
            } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { handleLogin } from "../Security/loadPrivatekey.js";

            // Your Firebase configuration
        const firebaseConfig = window.firebaseConfig;


            // Initialize Firebase
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);

            // DOM elements
            const phoneSection = document.getElementById('phone-section');
            const otpSection = document.getElementById('otp-section');
            const sendOtpBtn = document.getElementById('sendOtpBtn');
            const verifyOtpBtn = document.getElementById('verifyOtpBtn');
            const backToPhoneBtn = document.getElementById('backToPhoneBtn');
            const phoneNumberInput = document.getElementById('phoneNumber');
            const otpInput = document.getElementById('otp');
            const statusMessage = document.getElementById('status-message');

            let recaptchaVerifier;


            // Show status message
            function showStatus(message, isError = false) {
                statusMessage.textContent = message;
                statusMessage.className = isError ? 'status-message error-message' : 'status-message success';
                statusMessage.style.display = 'block';

                if (!isError) {
                    setTimeout(() => {
                        statusMessage.style.display = 'none';
                    }, 3000);
                }
            }

            // Setup reCAPTCHA
          function setupRecaptcha() {
        if (!recaptchaVerifier) {
          // Pass the 'auth' instance directly as the third argument.
          recaptchaVerifier = new RecaptchaVerifier(
            auth, // Pass the auth instance here directly
            "recaptcha-container",
            {
              size: "invisible",
              callback: (response) => {
                // reCAPTCHA solved
                console.log("reCAPTCHA solved!");
              },
              "expired-callback": () => {
                // Response expired. Ask user to solve reCAPTCHA again.
                console.log("reCAPTCHA expired. Please try again.");
              }
            }
          );
          recaptchaVerifier.render().then((widgetId) => {
            window.recaptchaWidgetId = widgetId;
            console.log("reCAPTCHA rendered with widget ID:", widgetId);
          }).catch(error => {
            console.error("Error rendering reCAPTCHA:", error);
          });
        }
      }

            // Initialize when DOM is loaded
            document.addEventListener("DOMContentLoaded", () => {
                setupRecaptcha();
            });

            // Send OTP
            sendOtpBtn.addEventListener('click', async () => {
                let phoneNumber = phoneNumberInput.value.trim();


                  if (!phoneNumber.startsWith('+')) {
                      
                        phoneNumber = phoneNumber.replace(/^0+/, '');
                        phoneNumber = '+91' + phoneNumber;
                            }


                if (!phoneNumber) {
                    showStatus("Please enter your phone number", true);
                    return;
                }

                try {
                    showStatus("Sending OTP...");
                  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
                    window.confirmationResult = confirmationResult;

                    // Switch to OTP section
                    phoneSection.style.display = 'none';
                    otpSection.style.display = 'block';
                    showStatus("OTP sent successfully!");
                } catch (error) {
                    console.error("OTP Error:", error);
                    showStatus("Error sending OTP: " + error.message, true);

                    // Reset reCAPTCHA
                    if (recaptchaVerifier) {
                        recaptchaVerifier.clear();
                        setupRecaptcha();
                    }
                }
            });

            // Verify OTP
            verifyOtpBtn.addEventListener('click', async () => {
                const otp = otpInput.value.trim();

                if (!otp || otp.length !== 6) {
                    showStatus("Please enter a valid 6-digit OTP", true);
                    return;
                }

                try {
                    showStatus("Verifying OTP...");
                    const result = await confirmationResult.confirm(otp);
                    const token = await result.user.getIdToken();

                    // Verify with your backend
                    const response = await fetch("/auth/verify-firebase", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token }),
                    });

                    const data = await response.json()


                    if (response.ok) {
                        showStatus("Login successful! Redirecting...");
                        if(data.success){
                        await handleLogin(data.userId)
                        }
                if (data.redirect) {
                       window.location.href = data.redirect; // redirect to pin page
                   }
                   else{
                        window.location.href = "/chat";
                   }
                    } else {
                        throw new Error("Backend verification failed");
                    }
                } catch (error) {
                    console.error("Verification Error:", error);
                    showStatus("Invalid OTP or verification failed: " + error.message, true);
                }
            });

            // Back to phone number
            backToPhoneBtn.addEventListener('click', () => {
                otpSection.style.display = 'none';
                phoneSection.style.display = 'block';
                otpInput.value = '';
                showStatus("", false);
            });