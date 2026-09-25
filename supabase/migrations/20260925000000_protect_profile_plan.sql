-- منار — حماية عمود الاشتراك (plan) من التعديل من داخل التطبيق.
--
-- كانت الصلاحية UPDATE/INSERT ممنوحة لدور authenticated على كل أعمدة
-- public.profiles، وسياسة RLS «profiles_update_own» تسمح للمستخدم بتعديل صفّه،
-- فكان بوسع أي مستخدم أن يرفع نفسه إلى «منار +» باستدعاء واحد:
--   update profiles set plan = 'premium' where id = auth.uid();
--
-- الحل: صلاحيات على مستوى العمود. يبقى للمستخدم تعديل بياناته الشخصية فقط،
-- ولا يغيّر plan (ولا id ولا created_at) إلا service_role — أي الخادم أو لوحة
-- التحكم أو دالة دفع موثوقة لاحقاً. سياسات RLS الحالية لا تتغيّر.

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;

GRANT INSERT (id, full_name, email, avatar_url, country, city, preferred_language)
  ON public.profiles TO authenticated;

GRANT UPDATE (full_name, avatar_url, country, city, preferred_language)
  ON public.profiles TO authenticated;

-- الإدخال المباشر يبدأ دائماً بالخطة المجانية حتى لو حاول العميل غير ذلك
-- (plan ليس ضمن أعمدة INSERT الممنوحة، فيأخذ قيمته الافتراضية 'free').
COMMENT ON COLUMN public.profiles.plan IS
  'Subscription tier. Writable by service_role only (see 20260925000000_protect_profile_plan.sql).';
