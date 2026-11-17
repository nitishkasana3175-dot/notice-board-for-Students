# ABES Department-Wise Digital Notice Board

A full-stack web application designed to simplify college notice management at ABES Engineering College.

## Features

- Add new notices with title, description, department and date.
- View all notices in an organized dashboard.
- Filter notices by department.
- Delete existing notices.
- Dashboard statistics.
- Persistent data storage using JSON files.
- REST API integration.

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Storage:** JSON File
- **API:** REST API
- **Version Control:** Git and GitHub

## Project Structure

```text
abes-notice-board/
├── server.js
├── package.json
├── data/
│   └── notices.json
└── public/
    ├── index.html
    ├── style.css
    └── script.js
```

## Installation & Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Start the application:

```bash
npm start
```

4. Open your browser:

```text
http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/notices | Fetch notices |
| POST | /api/notices | Add a notice |
| DELETE | /api/notices/:id | Delete a notice |

## Author

Developed as a college project for ABES Engineering College.