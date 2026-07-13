document.addEventListener("DOMContentLoaded", () => {
    // Select ALL buttons with the trigger class
    const uploadBtns = document.querySelectorAll(".js-upload-trigger");
    const fileInput = document.getElementById("global-file-input");

    if (uploadBtns.length > 0 && fileInput) {
        
        // Loop through all buttons and attach the click listener
        uploadBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                fileInput.click();
            });
        });

        // The change listener remains exactly the same
        fileInput.addEventListener("change", (event) => {
            const selectedFile = event.target.files[0];
            
            if (selectedFile) {
                if (selectedFile.type !== "application/pdf") {
                    alert("Please select a valid PDF file.");
                    fileInput.value = ""; 
                    return;
                }
                
                const maxSizeInBytes = 50 * 1024 * 1024;
                if (selectedFile.size > maxSizeInBytes) {
                    alert("File is too large. Maximum size is 50MB.");
                    fileInput.value = ""; 
                    return;
                }

                console.log("Valid file ready for upload:", selectedFile.name);
                alert(`File ready: ${selectedFile.name}`);
            }
        });
    }
});