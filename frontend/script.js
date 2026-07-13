document.addEventListener("DOMContentLoaded", () => {
    // Buttons and Inputs
    const uploadBtns = document.querySelectorAll(".js-upload-trigger");
    const fileInput = document.getElementById("global-file-input");
    const resetBtn = document.getElementById("reset-btn");

    // Views
    const uploadView = document.getElementById("upload-view");
    const loadingView = document.getElementById("loading-view");
    const resultView = document.getElementById("result-view");
    
    // UI Elements for Loading/Result
    const summaryOutput = document.getElementById("summary-output");
    const progressBar = document.getElementById('main-progress');
    const progressText = document.getElementById('progress-percent');
    const statusTitle = document.getElementById('status-title');
    const statusSubtitle = document.getElementById('status-subtitle');

    // Report dashboard elements
    const sidebarDocTitle = document.getElementById("sidebar-doc-title");
    const resultTitle = document.getElementById("result-title");
    const resultFilename = document.getElementById("result-filename");
    const resultDate = document.getElementById("result-date");
    const resultConfidence = document.getElementById("result-confidence");
    const resultPages = document.getElementById("result-pages");
    const insightsSection = document.getElementById("insights-section");
    const insightsContainer = document.getElementById("insights-container");
    const dataSection = document.getElementById("data-section");
    const dataPointsBody = document.getElementById("data-points-body");

    // Maps an insight "type" from the API to an icon + color treatment
    const INSIGHT_STYLES = {
        positive: { icon: "trending_up", bg: "bg-primary-container", text: "text-on-primary" },
        neutral: { icon: "info", bg: "bg-tertiary-container", text: "text-on-tertiary" },
        risk: { icon: "warning", bg: "bg-error-container", text: "text-error" },
    };

    function renderReport(data) {
        const title = data.title || "Document Report";
        sidebarDocTitle.innerText = title;
        resultTitle.innerText = title;
        resultFilename.innerText = `Source Document: ${data.filename || "unknown.pdf"}`;
        resultDate.innerText = data.date || "—";
        resultConfidence.innerText = data.extraction_confidence != null
            ? `${data.extraction_confidence}%`
            : "—";
        resultPages.innerText = data.pages_analyzed != null ? data.pages_analyzed : "—";
        summaryOutput.innerText = data.summary || "No summary available.";

        // Insights (hide the whole section if the API returned none)
        insightsContainer.innerHTML = "";
        const insights = data.insights || [];
        if (insights.length === 0) {
            insightsSection.classList.add("hidden");
        } else {
            insightsSection.classList.remove("hidden");
            insights.forEach(insight => {
                const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.neutral;
                const card = document.createElement("div");
                card.className = "border border-outline-variant rounded p-4 bg-surface-bright hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow";
                card.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded ${style.bg} flex items-center justify-center flex-shrink-0 ${style.text}">
                            <span class="material-symbols-outlined text-[18px]">${style.icon}</span>
                        </div>
                        <div>
                            <h3 class="font-headline-sm text-headline-sm text-on-surface"></h3>
                            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1"></p>
                        </div>
                    </div>`;
                card.querySelector("h3").innerText = insight.heading || "";
                card.querySelector("p").innerText = insight.description || "";
                insightsContainer.appendChild(card);
            });
        }

        // Data points (hide the whole section if the API returned none)
        dataPointsBody.innerHTML = "";
        const dataPoints = data.data_points || [];
        if (dataPoints.length === 0) {
            dataSection.classList.add("hidden");
        } else {
            dataSection.classList.remove("hidden");
            dataPoints.forEach(dp => {
                const row = document.createElement("tr");
                row.className = "border-b border-outline-variant hover:bg-surface-bright transition-colors";
                row.innerHTML = `
                    <td class="py-3 px-4 text-on-surface"></td>
                    <td class="py-3 px-4 font-code-sm"></td>
                    <td class="py-3 px-4 text-on-surface-variant"></td>`;
                const cells = row.querySelectorAll("td");
                cells[0].innerText = dp.label || "";
                cells[1].innerText = dp.value || "";
                cells[2].innerText = dp.note || "";
                dataPointsBody.appendChild(row);
            });
        }
    }

    // 1. Trigger hidden file input
    if (uploadBtns.length > 0 && fileInput) {
        uploadBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                fileInput.click();
            });
        });

        // 2. Handle File Selection & Upload
        fileInput.addEventListener("change", (event) => {
            const selectedFile = event.target.files[0];
            
            if (selectedFile) {
                // Validation
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

                // SWITCH VIEWS: Hide Upload, Show Loading
                uploadView.classList.add("hidden");
                loadingView.classList.remove("hidden");

                // Start Fake Progress Animation
                let progress = 0;
                const interval = setInterval(() => {
                    // Slowly tick up to 95%, but don't hit 100% until the API finishes
                    if (progress < 95) {
                        progress += Math.random() * 5 + 1; 
                        progressBar.style.width = `${Math.min(progress, 95)}%`;
                        progressText.innerText = `${Math.floor(Math.min(progress, 95))}%`;
                    }
                    
                    // Update text based on progress
                    if (progress > 30) {
                        statusTitle.innerText = "Generating AI Insights...";
                        statusSubtitle.innerText = "Applying advanced contextual models";
                    }
                    if (progress > 70) {
                        statusTitle.innerText = "Formatting Final Report...";
                        statusSubtitle.innerText = "Compiling data tables and summaries";
                    }
                }, 800);

                // Execute the actual API Call
                const formData = new FormData();
                formData.append("file", selectedFile);

                fetch("http://127.0.0.1:8000/summarize", {
                    method: "POST",
                    body: formData
                })
                .then(response => {
                    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    // API Finished! Stop the animation
                    clearInterval(interval);

                    // Bump to 100% instantly
                    progressBar.style.width = `100%`;
                    progressText.innerText = `100%`;
                    statusTitle.innerText = "Processing Complete";
                    statusSubtitle.innerText = "Displaying report...";

                    // Wait half a second for the 100% animation to finish, then show results
                    setTimeout(() => {
                        loadingView.classList.add("hidden");
                        resultView.classList.remove("hidden");
                        renderReport(data);
                    }, 800);
                })
                .catch(error => {
                    clearInterval(interval);
                    console.error("Error summarizing PDF:", error);
                    alert("Something went wrong with the server. Check the console.");
                    // Reset UI on failure
                    loadingView.classList.add("hidden");
                    uploadView.classList.remove("hidden");
                });
            }
        });
    }

    // 3. Reset Button Logic (To summarize another document)
    if(resetBtn) {
        resetBtn.addEventListener("click", () => {
            fileInput.value = ""; // clear file
            resultView.classList.add("hidden");
            uploadView.classList.remove("hidden");
            
            // Reset loading UI for next time
            progressBar.style.width = `0%`;
            progressText.innerText = `0%`;
            statusTitle.innerText = "Analyzing Document Structure...";
            statusSubtitle.innerText = "Extracting key entities and metadata";
        });
    }
});