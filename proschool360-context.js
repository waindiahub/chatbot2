// ProSchool360 specific context for accurate responses
const proschool360Context = {
  studentManagement: {
    addStudent: {
      route: 'student/add',
      controller: 'Student',
      method: 'add()',
      url: 'base_url("student/admission")',
      permission: 'get_permission("student", "is_add")',
      menuPath: 'Admission → Create Admission',
      dashboardButton: 'Add Student button links to student/admission',
      fields: [
        'first_name', 'last_name', 'register_no',
        'class_id', 'section_id', 'roll',
        'current_address', 'permanent_address',
        'guardian_name', 'guardian_relation', 'father_name', 'mother_name',
        'guardian_mobile_no', 'guardian_email', 'guardian_address',
        'student_mobile_no', 'student_email',
        'birthday', 'gender', 'blood_group', 'religion',
        'mother_tongue', 'caste', 'city', 'state'
      ],
      process: [
        '1. Login with admin credentials',
        '2. Navigate to Dashboard',
        '3. Click "Add Student" button or go to Admission menu',
        '4. Select "Create Admission" (student/add route)',
        '5. Fill student information form with required fields',
        '6. Add guardian/parent information',
        '7. Upload student photo (optional)',
        '8. Save student record',
        '9. System generates register_no automatically if configured'
      ]
    }
  }
};

module.exports = proschool360Context;