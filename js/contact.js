// Contact page specific functionality

function submitContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // In a real application, this would send data to a server
    console.log('Contact form submitted:', data);
    
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
    }, 5000);
}
