
const form = document.getElementById("complaintForm");
const titleInput = document.getElementById("title");
const locationInput = document.getElementById("location");
const descriptionInput = document.getElementById("description");
const complaintList = document.getElementById("complaintList");
const message = document.getElementById("message");

const complaints = [];
let nextId = 1;

function displayComplaints() {
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

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const location = locationInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title || !location || !description) {
    message.textContent = "Please fill in every field.";
    return;
  }

  complaints.push({
    id: nextId++,
    title,
    location,
    description,
    status: "Pending"
  });

  displayComplaints();
  form.reset();
  message.textContent = "Complaint submitted successfully.";
});

displayComplaints(); 