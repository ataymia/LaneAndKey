// Contact page specific functionality

function submitContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    
    // Get form data
    const formData = new FormData(form);
    const submission = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        interest: formData.get('interest'),
        message: formData.get('message')
    };
    
    // Save to local storage
    try {
        saveContactSubmission(submission);
        
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
    } catch (error) {
        console.error('Failed to save contact submission:', error);
        alert('Sorry, there was an error submitting your message. Please try again.');
        
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}
