exports.submitApplication = async (req, res) => {
  console.log(req.body);   // categories, services, years_of_experience, offers_home_service
  console.log(req.files);  // validId, selfie, supportingDocs
  res.json({ message: 'Application received' });
};