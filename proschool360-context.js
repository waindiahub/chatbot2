// ProSchool360 specific context for accurate responses
const proschool360Context = {
  domain: 'https://proschool360.com',
  studentManagement: {
    addStudent: {
      menuPath: 'Dashboard → Admission → Create Admission',
      url: 'https://proschool360.com/student/add',
      steps: [
        '1. Login to ProSchool360 at https://proschool360.com',
        '2. Go to Dashboard',
        '3. Click "Add Student" button OR navigate to Admission menu',
        '4. Select "Create Admission"',
        '5. Fill out the student information form',
        '6. Enter guardian/parent details',
        '7. Upload student photo (optional)',
        '8. Click Save to add the student'
      ],
      requiredInfo: [
        'Student Name (First & Last)',
        'Date of Birth',
        'Gender',
        'Class and Section',
        'Contact Information',
        'Address (Current & Permanent)',
        'Guardian/Parent Information',
        'Emergency Contact Details'
      ]
    }
  }
};

module.exports = proschool360Context;