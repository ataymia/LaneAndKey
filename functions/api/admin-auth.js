/**
 * Cloudflare Pages Function for Admin Authentication
 * 
 * This function securely validates admin credentials against environment variables
 * without exposing them in client-side JavaScript.
 * 
 * Environment Variables Required:
 * - ADMIN_USERNAME: The admin username
 * - ADMIN_PASSWORD: The admin password
 */

export async function onRequestPost(context) {
    try {
        // Get credentials from environment variables
        const adminUsername = context.env.ADMIN_USERNAME;
        const adminPassword = context.env.ADMIN_PASSWORD;

        // Check if environment variables are configured
        if (!adminUsername || !adminPassword) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Server configuration error. Admin credentials not configured.'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Parse request body
        const body = await context.request.json();
        const { username, password } = body;

        // Validate input
        if (!username || !password) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Username and password are required.'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Validate credentials
        if (username === adminUsername && password === adminPassword) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Authentication successful.'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid username or password.'
            }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'An error occurred during authentication.'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// Handle CORS preflight requests
export async function onRequestOptions(context) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}
