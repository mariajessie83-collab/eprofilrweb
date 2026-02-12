// Connection monitoring for POD Rounding page
window.connectionMonitor = {
    dotNetRef: null,
    isInitialized: false,

    initialize: function (dotNetReference) {
        this.dotNetRef = dotNetReference;

        // Prevent adding duplicate listeners
        if (this.isInitialized) {
            console.log('Connection monitoring reference updated');
            return;
        }

        // Define handlers (closure to access this.dotNetRef)
        const onOnline = () => {
            console.log('Connection: ONLINE');
            if (this.dotNetRef) {
                this.dotNetRef.invokeMethodAsync('UpdateConnectionFromJS', true);
            }
        };

        const onOffline = () => {
            console.log('Connection: OFFLINE');
            if (this.dotNetRef) {
                this.dotNetRef.invokeMethodAsync('UpdateConnectionFromJS', false);
            }
        };

        // Add event listeners
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        this.isInitialized = true;
        console.log('Connection monitoring initialized');
    }
};
