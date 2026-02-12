window.printIframe = (iframeId) => {
    try {
        const iframe = document.getElementById(iframeId);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } else {
            console.error("Iframe not found or not ready: " + iframeId);
            // Fallback: try window.print()
            window.print();
        }
    } catch (error) {
        console.error("Print error:", error);
        // Fallback: try window.print()
        try {
            window.print();
        } catch (e) {
            console.error("Fallback print also failed:", e);
        }
    }
};

// Clear iframe safely
window.clearIframe = (iframeId) => {
    try {
        const iframe = document.getElementById(iframeId);
        if (iframe) {
            iframe.src = 'about:blank';
        }
    } catch (error) {
        console.error("Error clearing iframe:", error);
    }
};

window.downloadPdfFromApi = async function(url, podName) {
    try {
        console.log('Fetching PDF from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-POD-Name': podName || ''
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response content-type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            throw new Error('Failed to download PDF: ' + response.status);
        }
        
        // Check if response is actually a PDF
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
            const text = await response.text();
            console.error('Not a PDF response:', text);
            throw new Error('Server did not return a PDF');
        }
        
        const blob = await response.blob();
        console.log('Blob size:', blob.size);
        
        if (blob.size === 0) {
            throw new Error('PDF file is empty');
        }
        
        // Get filename from content-disposition header
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'ParentConferenceRequest.pdf';
        
        console.log('Content-Disposition:', contentDisposition);
        
        if (contentDisposition) {
            // Try to extract filename from header
            const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;\r\n"']*)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
                fileName = decodeURIComponent(filenameMatch[1]);
            } else {
                const simpleMatch = contentDisposition.match(/filename=([^;\s]+)/);
                if (simpleMatch && simpleMatch[1]) {
                    fileName = simpleMatch[1].replace(/['"]/g, '');
                }
            }
        }
        
        console.log('Downloading as:', fileName);
        
        // Create download link and trigger download
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup after a short delay
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        }, 100);
        
        console.log('PDF downloaded successfully:', fileName);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Error downloading PDF: ' + error.message);
    }
};
