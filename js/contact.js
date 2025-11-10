// Contact page specific functionality

function submitContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    
    // Send email using EmailJS
    emailjs.sendForm('service_jvahbns', 'template_oiutm97', form)
        .then(function(response) {
            console.log('Email sent successfully:', response);
            
            // Hide form and show success message
            form.style.display = 'none';
            const successMessage = document.getElementById('contact-success');
            const errorMessage = document.getElementById('contact-error');
            if (successMessage) {
                successMessage.style.display = 'block';
            }
            if (errorMessage) {
                errorMessage.style.display = 'none';
            }
            
            // Reset and show form again after 5 seconds
            setTimeout(() => {
                form.reset();
                form.style.display = 'block';
                if (successMessage) {
                    successMessage.style.display = 'none';
                }
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }, 5000);
        }, function(error) {
            console.error('Failed to send email:', error);
            
            // Show error message
            const successMessage = document.getElementById('contact-success');
            const errorMessage = document.getElementById('contact-error');
            if (successMessage) {
                successMessage.style.display = 'none';
            }
            if (errorMessage) {
                errorMessage.style.display = 'block';
            }
            
            // Hide error message after 5 seconds
            setTimeout(() => {
                if (errorMessage) {
                    errorMessage.style.display = 'none';
                }
            }, 5000);
            
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        });
}
