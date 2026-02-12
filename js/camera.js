window.cameraInterop = {
    videoStream: null,
    videoElement: null,

    startCamera: async function (videoElementId) {
        this.videoElement = document.getElementById(videoElementId);

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // Try to get the rear camera (environment) first
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } }
                });
                this.videoStream = stream;
                this.videoElement.srcObject = stream;
                await this.videoElement.play();
                return true;
            } catch (err) {
                console.error("Error accessing camera: ", err);
                return false;
            }
        } else {
            console.error("getUserMedia not supported");
            return false;
        }
    },

    captureImage: function () {
        if (!this.videoElement || !this.videoStream) return null;

        const canvas = document.createElement("canvas");
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        return canvas.toDataURL("image/jpeg");
    },

    stopCamera: function () {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
        }

        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
    }
};
