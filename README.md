# Department-Wise Digital Notice Board System

## Live Deployment

**Live Website:** https://notice-board-for-students-5leb.onrender.com


A college Full Stack Development project for displaying and managing department-wise notices at ABESEC Ghaziabad.



## Current implemented features

- View notices from all departments.
- Filter notices by department (CSE, IT, ECE, ME and Civil).
- Add notices with title, description, department and date.
- Delete notices.
- Dashboard statistics (total notices, currently shown and latest notice date).
- REST API using Node.js and Express.
- JSON-file based notice storage.
- Responsive blue-and-white interface.
- ABESEC Ghaziabad header and project footer.

## Technology stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Storage:** JSON file (`data/notices.json`)
- **API:** REST API
- **Deployment:** Render
- **Version control:** Git and GitHub

## Project structure

```text
abes-notice-board/
├── data/
│   └── notices.json
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── server.js
├── package.json
└── README.md
```

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Render deployment

This repository contains a `render.yaml` Blueprint file at the repository root.

1. Push the latest project files to GitHub.
2. In Render, choose **New + → Blueprint**.
3. Connect `nitishkasana3175-dot/notice-board-for-Students`.
4. Render should detect `render.yaml` and create the Node web service.
5. After deployment, open the generated `onrender.com` URL.
6. Test the home page and `/health`, then replace the placeholder above with the actual URL.
7. Commit and push this README update after adding the real URL.

The service listens on `process.env.PORT`, as required by Render.

### Important storage note

The current version stores notices in a local JSON file. Render's default service filesystem is ephemeral, so file changes may be lost when the service restarts or is redeployed. For reliable long-term production storage, connect a persistent database or a supported persistent disk before relying on the app for important notices.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Deployment health check |
| GET | `/api/notices` | Fetch notices |
| POST | `/api/notices` | Add a notice |
| DELETE | `/api/notices/:id` | Delete a notice |

## Demo login credentials and user roles

## Demo login credentials and user roles

Login is required. Authentication uses bcrypt-hashed passwords and JWT, and permissions are enforced on the server.

| Role    | Username  | Password        | Permissions                          |
| ------- | --------- | --------------- | ------------------------------------ |
| Admin   | `admin`   | `Admin@12345`   | View, Add and Delete notices         |
| Faculty | `faculty` | `Faculty@12345` | View and Add notices                 |
| Student | `student` | `Student@12345` | View notices only                    |

**How to log in:** run `npm start`, open `http://localhost:3000`, and log in as Admin first.

> These are demo-only credentials. Change them before real use by setting `ADMIN_PASSWORD`, `FACULTY_PASSWORD` and `STUDENT_PASSWORD` in the environment.

## Team

- **Navneet Kumar Verma**
- **Nitish Kasana**
- **Branch:** CSE
- **Section:** 22

**Full Stack Development Team**  
© 2026 ABESEC Ghaziabad. All Rights Reserved.
