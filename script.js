
const form = document.getElementById("complaintForm");
const titleInput = document.getElementById("title");
const locationInput = document.getElementById("location");
const descriptionInput = document.getElementById("description");
const complaintList = document.getElementById("complaintList");
const message = document.getElementById("message");
const complaintsApiUrl = "http://localhost:3000/api/complaints";

function displayComplaints(complaints) {
  complaintList.replaceChildren();

  if (complaints.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No complaints yet.";
    complaintList.appendChild(emptyMessage);
    return;
  }

  complaints.forEach((complaint) => {
    const card = document.createElement("article");
    card.className = "complaint";

    const heading = document.createElement("h3");
    heading.textContent = complaint.title;

    const location = document.createElement("p");
    location.textContent = "Location: " + complaint.location;

    const description = document.createElement("p");
    description.textContent = complaint.description;

    const status = document.createElement("p");
    status.className = "status";
    status.textContent = "Status: " + complaint.status;

    card.append(heading, location, description, status);
    complaintList.appendChild(card);
  });
}

async function loadComplaints() {
  const response = await fetch(complaintsApiUrl);
  if (!response.ok) {
    throw new Error("Could not load complaints.");
  }

  const data = await response.json();
  displayComplaints(data.complaints);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const location = locationInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title || !location || !description) {
    message.textContent = "Please fill in every field.";
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  message.textContent = "Submitting complaint...";

  try {
    const response = await fetch(complaintsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, description })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not submit complaint.");
    }

    form.reset();
    message.textContent = "Complaint submitted successfully.";
    await loadComplaints();
  } catch (error) {
    message.textContent = error.message || "Could not submit complaint.";
  } finally {
    submitButton.disabled = false;
  }
});

loadComplaints().catch((error) => {
  message.textContent = error.message;
});