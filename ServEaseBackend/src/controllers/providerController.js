/**
 * Service provider application controller.
 * Mirrors the mobile 3-step application flow (personal details,
 * service category, verification requirements).
 * @format
 */

import { getSupabase } from '../config/supabase.js';
import { uploadVerificationDocument } from '../utils/storage.js';
import {
  findMissingFields,
  isEmail,
  isTruthy,
  parseStringArray,
  toIsoDate,
} from '../utils/validators.js';

const publicApplication = application => ({
  id: application.id,
  userId: application.user_id,
  status: application.status,
  firstName: application.first_name,
  middleName: application.middle_name,
  lastName: application.last_name,
  dateOfBirth: application.date_of_birth,
  gender: application.gender,
  email: application.email,
  phone: application.phone,
  address: application.address,
  categories: application.categories,
  services: application.services,
  otherServices: application.other_services,
  yearsExperience: application.years_experience,
  offersHomeService: application.offers_home_service,
  validIdUrl: application.valid_id_url,
  selfieUrl: application.selfie_url,
  supportingDocsUrl: application.supporting_docs_url,
  reviewerNotes: application.reviewer_notes,
  reviewedAt: application.reviewed_at,
  createdAt: application.created_at,
});

const validateSubmission = (body, files) => {
  const missing = findMissingFields(body, [
    'firstName',
    'lastName',
    'dateOfBirth',
    'gender',
    'email',
    'phone',
    'address',
    'yearsExperience',
    'offersHomeService',
  ]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}.`;
  }
  if (!isEmail(body.email)) {
    return 'Please provide a valid email address.';
  }
  if (!parseStringArray(body.categories).length) {
    return 'Please select at least one service category.';
  }
  if (!files.validId?.[0] || !files.selfie?.[0]) {
    return 'Please upload your valid ID and selfie verification.';
  }
  if (!isTruthy(body.agreeCertify) || !isTruthy(body.agreeTerms)) {
    return 'Please accept the required agreements.';
  }
  return null;
};

/**
 * POST /api/providers/applications
 * Multipart form: personal details + categories/services fields,
 * files "validId" (required), "selfie" (required), "supportingDocs" (optional).
 */
export const submitApplication = async (req, res, next) => {
  try {
    const body = req.body;
    const files = req.files || {};
    const validationError = validateSubmission(body, files);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('provider_applications')
      .select('id')
      .eq('user_id', req.user.sub)
      .in('status', ['pending', 'under_review'])
      .limit(1);
    if (existing?.length) {
      return res
        .status(409)
        .json({ message: 'You already have an application under review.' });
    }

    const userId = req.user.sub;
    const validIdPath = await uploadVerificationDocument(
      userId,
      'valid-id',
      files.validId[0],
    );
    const selfiePath = await uploadVerificationDocument(
      userId,
      'selfie',
      files.selfie[0],
    );
    const supportingPath = files.supportingDocs?.[0]
      ? await uploadVerificationDocument(
          userId,
          'supporting-docs',
          files.supportingDocs[0],
        )
      : null;

    const { data: application, error } = await supabase
      .from('provider_applications')
      .insert({
        user_id: userId,
        first_name: body.firstName.trim(),
        middle_name: body.middleName?.trim() || null,
        last_name: body.lastName.trim(),
        date_of_birth: toIsoDate(body.dateOfBirth),
        gender: body.gender,
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        address: body.address.trim(),
        categories: parseStringArray(body.categories),
        services: parseStringArray(body.services),
        other_services: body.otherServices?.trim() || null,
        years_experience: Number.parseInt(body.yearsExperience, 10) || 0,
        offers_home_service: isTruthy(body.offersHomeService),
        valid_id_url: validIdPath,
        selfie_url: selfiePath,
        supporting_docs_url: supportingPath,
      })
      .select()
      .single();
    if (error) {
      return res
        .status(500)
        .json({ message: 'Failed to submit the application.' });
    }

    return res.status(201).json({
      message: 'Thank you! Your application is now under review.',
      application: publicApplication(application),
    });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/providers/applications/me */
export const getMyApplication = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: application } = await supabase
      .from('provider_applications')
      .select('*')
      .eq('user_id', req.user.sub)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!application) {
      return res.status(404).json({ message: 'No application found.' });
    }
    return res.json({ application: publicApplication(application) });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/providers/applications (admin) */
export const listApplications = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: applications, error } = await supabase
      .from('provider_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      return res.status(500).json({ message: 'Failed to load applications.' });
    }
    return res.json({ applications: applications.map(publicApplication) });
  } catch (error) {
    return next(error);
  }
};

/** PATCH /api/providers/applications/:id/review (admin) */
export const reviewApplication = async (req, res, next) => {
  try {
    const { action, notes } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res
        .status(400)
        .json({ message: 'Action must be either "approve" or "reject".' });
    }

    const supabase = getSupabase();
    const { data: application, error } = await supabase
      .from('provider_applications')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewer_notes: notes?.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error || !application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (action === 'approve') {
      await supabase
        .from('users')
        .update({ role: 'service_provider' })
        .eq('id', application.user_id);
    }

    return res.json({
      message: `Application ${application.status}.`,
      application: publicApplication(application),
    });
  } catch (error) {
    return next(error);
  }
};
