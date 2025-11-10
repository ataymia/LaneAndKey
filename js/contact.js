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
            if (successMessage) {
                successMessage.style.display = 'block';
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
            alert('Sorry, there was an error sending your message. Please try again or contact us directly at laneandkey@gmail.com');
            
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        });
}
