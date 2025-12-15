// Error Handler for TranslateMe Extension
// Provides consistent error handling and user-friendly messages

class ErrorHandler {
    static handleError(error, context = 'Unknown') {
        console.error(`❌ Error in ${context}:`, error);
        
        // Extract meaningful error information
        let errorMessage = 'An unexpected error occurred';
        let errorType = 'unknown';
        
        if (error instanceof Error) {
            errorMessage = error.message;
            errorType = 'error';
        } else if (typeof error === 'string') {
            errorMessage = error;
            errorType = 'string';
        } else if (typeof error === 'object' && error !== null) {
            // Handle Supabase errors
            if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage = error.error;
            } else if (error.details) {
                errorMessage = error.details;
            } else {
                errorMessage = JSON.stringify(error);
            }
            errorType = 'object';
        }
        
        // Log detailed error information
        console.error('Error details:', {
            context,
            message: errorMessage,
            type: errorType,
            originalError: error
        });
        
        return {
            message: errorMessage,
            type: errorType,
            context,
            original: error
        };
    }
    
    static getUserFriendlyMessage(error, context = 'Unknown') {
        const errorInfo = this.handleError(error, context);
        
        // Map common error messages to user-friendly versions
        const friendlyMessages = {
            'Could not establish connection': 'Extension not loaded on this page',
            'Receiving end does not exist': 'Extension not loaded on this page',
            'Failed to fetch': 'Network connection error',
            'Unauthorized': 'Authentication required',
            'Forbidden': 'Access denied',
            'Not found': 'Resource not found',
            'Rate limit exceeded': 'Too many requests, please wait',
            'Database connection failed': 'Database temporarily unavailable',
            'Invalid credentials': 'Authentication failed'
        };
        
        // Check for known error patterns
        for (const [pattern, friendlyMessage] of Object.entries(friendlyMessages)) {
            if (errorInfo.message.includes(pattern)) {
                return friendlyMessage;
            }
        }
        
        // Return sanitized error message
        return errorInfo.message.length > 100 
            ? errorInfo.message.substring(0, 100) + '...'
            : errorInfo.message;
    }
    
    static async safeExecute(asyncFunction, context = 'Unknown') {
        try {
            return await asyncFunction();
        } catch (error) {
            const errorInfo = this.handleError(error, context);
            return {
                success: false,
                error: errorInfo.message,
                details: errorInfo
            };
        }
    }
    
    static logError(error, context = 'Unknown', additionalInfo = {}) {
        const errorInfo = this.handleError(error, context);
        
        console.group(`🚨 Error in ${context}`);
        console.error('Message:', errorInfo.message);
        console.error('Type:', errorInfo.type);
        console.error('Context:', context);
        if (Object.keys(additionalInfo).length > 0) {
            console.error('Additional Info:', additionalInfo);
        }
        console.error('Original Error:', errorInfo.original);
        console.groupEnd();
        
        return errorInfo;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}
