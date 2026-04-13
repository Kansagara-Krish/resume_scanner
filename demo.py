import os
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

# ====== CHANGE THIS PATH ======
output_folder = r"C:\Desktop file\2026\resume_scanner\resume-scanner\testing_data\extra_resume"   # օրինակ: r"C:\Users\YourName\Documents\resumes"

# Create folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

styles = getSampleStyleSheet()

def create_resume(file_path, name, phone, email, github, location, summary, skills, experience, education, certifications):
    doc = SimpleDocTemplate(file_path)
    elements = []

    # Header
    elements.append(Paragraph(f"<b>{name}</b>", styles['Title']))
    elements.append(Paragraph(f"{phone} | {email} | {github} | {location}", styles['Normal']))
    elements.append(Spacer(1, 10))

    # Summary
    elements.append(Paragraph("<b>PROFESSIONAL SUMMARY</b>", styles['Heading2']))
    elements.append(Paragraph(summary, styles['Normal']))
    elements.append(Spacer(1, 10))

    # Skills
    elements.append(Paragraph("<b>TECHNICAL SKILLS</b>", styles['Heading2']))
    elements.append(Paragraph(skills, styles['Normal']))
    elements.append(Spacer(1, 10))

    # Experience
    elements.append(Paragraph("<b>PROFESSIONAL EXPERIENCE</b>", styles['Heading2']))
    elements.append(Paragraph(experience, styles['Normal']))
    elements.append(Spacer(1, 10))

    # Education
    elements.append(Paragraph("<b>EDUCATION</b>", styles['Heading2']))
    elements.append(Paragraph(education, styles['Normal']))
    elements.append(Spacer(1, 10))

    # Certifications
    elements.append(Paragraph("<b>CERTIFICATIONS</b>", styles['Heading2']))
    elements.append(Paragraph(certifications, styles['Normal']))

    doc.build(elements)


# ====== DATA FOR 6 RESUMES ======

resumes = [
    {
        "name": "Amit Sharma",
        "summary": "Frontend Developer specializing in React and performance optimization.",
        "skills": "React, TypeScript, Redux, Tailwind CSS, Next.js",
    },
    {
        "name": "Neha Verma",
        "summary": "Creative frontend developer focused on Vue.js and UI design.",
        "skills": "Vue.js, JavaScript, CSS3, Bootstrap, REST APIs",
    },
    {
        "name": "Rahul Mehta",
        "summary": "Angular developer experienced in enterprise-grade applications.",
        "skills": "Angular, TypeScript, RxJS, SCSS, Material UI",
    },
    {
        "name": "Priya Desai",
        "summary": "Frontend developer working with GraphQL and modern React stack.",
        "skills": "React, GraphQL, Apollo, Styled Components",
    },
    {
        "name": "Karan Patel",
        "summary": "Frontend developer with strong fundamentals and web optimization.",
        "skills": "HTML5, CSS3, JavaScript, Webpack, Git",
    },
    {
        "name": "Sneha Iyer",
        "summary": "Frontend developer building fast apps using Next.js and Firebase.",
        "skills": "Next.js, TypeScript, Tailwind CSS, Firebase",
    }
]

# Common data
phone = "(555) 123-4567"
email = "example@email.com"
github = "github.com/example"
location = "India"

experience = """
Frontend Developer (2021 - Present)<br/>
• Built scalable web applications<br/>
• Improved performance and UI responsiveness<br/>
• Worked with APIs and modern frameworks
"""

education = "Bachelor of Computer Science (2021)"

certifications = """
• Frontend Developer Certification<br/>
• Advanced JavaScript Certification
"""

# ====== GENERATE FILES ======

for i, res in enumerate(resumes, start=1):
    file_name = f"Frontend_{i}.pdf"
    file_path = os.path.join(output_folder, file_name)

    create_resume(
        file_path,
        res["name"],
        phone,
        email,
        github,
        location,
        res["summary"],
        res["skills"],
        experience,
        education,
        certifications
    )

print("✅ All resumes generated successfully!")