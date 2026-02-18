// Contact page specific functionality

const CONTACT_FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/laneandkey1/databases/(default)/documents/contactSubmissions';

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
        phone: formData.get('phone') || '',
        interest: formData.get('interest'),
        message: formData.get('message')
    };
    
    // Submit to Firestore via REST API
    const firestoreDoc = {
        fields: {
            name: { stringValue: submission.name },
            email: { stringValue: submission.email },
            phone: { stringValue: submission.phone },
            interest: { stringValue: submission.interest },
            message: { stringValue: submission.message },
            status: { stringValue: 'new' },
            createdAt: { timestampValue: new Date().toISOString() },
            read: { booleanValue: false },
        }
    };

    fetch(CONTACT_FIRESTORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreDoc),
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to submit');
        return response.json();
    })
    .then(() => {
        // Also save to localStorage as backup
        try { saveContactSubmission(submission); } catch(e) { /* ignore */ }
        
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
    })
    .catch(error => {
        console.error('Failed to save contact submission:', error);
        // Try localStorage fallback
        try { saveContactSubmission(submission); } catch(e) { /* ignore */ }
        alert('Sorry, there was an error submitting your message. Please try again.');
        
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    });
}
