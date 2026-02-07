// Simple Task Database
// Format: "D-M-YYYY h:mmA"  (e.g., 12-2-2026 4:30PM)

const TASKS_DB = {
    "Taj": [
        {
            "desc": "Complete Employee Site",
            "due": "11-2-2026 12:00PM",
            "workingWith": [""]
        },
        {
            "desc": "Review Design Mockups",
            "due": "18-2-2026 2:00PM",
            "workingWith": []
        },
        {
            "desc": "Brainstorm App Ideas",
            "due": "",
            "workingWith": ["Indi"]
        }
    ],
    "Alex": [
        {
            "desc": "Set Up Firebase",
            "due": "10-3-2026 11:00PM",
            "workingWith": ["Gwish"]
        }
    ],
    "Gwish": [
        {
            "desc": "Set Up Firebase",
            "due": "10-3-2026 11:00PM",
            "workingWith": ["Alex"]
        }
    ],
    "Charlie": [],
    "Indi": [
        {
            "desc": "Brainstorm App Ideas",
            "due": "",
            "workingWith": ["Taj"]
        }
    ]
};
