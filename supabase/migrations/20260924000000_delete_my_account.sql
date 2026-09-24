-- منار — حذف الحساب من داخل التطبيق (متطلّب Google Play لسياسة حذف الحساب).
--
-- يحذف المستخدمُ حسابه بنفسه: الدالة تعمل بصلاحية المالك (SECURITY DEFINER)
-- لتصل إلى auth.users، لكنها لا تحذف إلا صفّ المتّصل نفسه (auth.uid())،
-- فلا يمكن لأحد حذف حساب غيره. وكل الجداول العامة مرتبطة بـ auth.users
-- بـ ON DELETE CASCADE، فتُحذف معه: الملف الشخصي، والإعدادات، وتفضيلات
-- الصلاة والتنبيهات، وتقدّم القراءة، والإنجازات.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_settings WHERE user_id = uid;
  DELETE FROM public.prayer_preferences WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;
  DELETE FROM public.reading_progress WHERE user_id = uid;
  DELETE FROM public.achievement_progress WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
