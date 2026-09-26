-- منار — عمود البريد في الملف الشخصي يُكتب من الخادم وحده.
--
-- ترحيل 20260925000000 منع تعديل `plan`، لكنه أبقى `email` ضمن أعمدة INSERT
-- الممنوحة لدور authenticated. التطبيق لا يُدرج صفّ الملف الشخصي أبداً — يُنشئه
-- المُطلِق `handle_new_user` (SECURITY DEFINER) من auth.users عند التسجيل — فلا
-- داعي لأن يستطيع العميل إدراج بريد لا يطابق حسابه.

REVOKE INSERT ON public.profiles FROM authenticated;

GRANT INSERT (id, full_name, avatar_url, country, city, preferred_language)
  ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.email IS
  'Mirrors auth.users.email. Written by handle_new_user() only (see 20260926000000_profile_email_readonly.sql).';
