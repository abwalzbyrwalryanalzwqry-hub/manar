package app.manar.islamic;

import java.util.Calendar;

/**
 * نقل أمين لحساب المواقيت في مكتبة adhan (الإصدار 4.4.x) المستخدمة في الويب،
 * ليولّد الويدجت مواقيت الأيام بعد نهاية اللقطة دون فتح التطبيق.
 *
 * <p>القواعد مطابقة لـ {@code computePrayerTimes} في {@code src/lib/prayer.ts}:
 * قاعدة خطوط العرض العالية الموصى بها (سُبع الليل فوق ٤٨°)، وحلّ الدائرة القطبية
 * بأقرب يوم (AqrabYaum)، والإزاحات اليدوية وإزاحات الطريقة. عشاء رمضان في أم القرى
 * يقرّره المستدعي بتمرير {@code ishaInterval}.
 *
 * <p>يحاكي دلالات {@code Date} في JavaScript: مكوّنات اليوم بالمنطقة المحلية،
 * و{@code Date.UTC} مع تجاوز الساعات، وبتر الكسور عند الإنشاء. تحرسه اختبارات
 * تطابق مولَّدة من المكتبة نفسها ({@code PrayerCalcTest}).
 */
final class PrayerCalc {

    private PrayerCalc() {}

    /** معاملات الحساب كما تحسبها الواجهة (بعد تطبيق الطريقة والإعدادات). */
    static final class Params {
        String method = "Other";
        double fajrAngle;
        double ishaAngle;
        int ishaInterval;
        double maghribAngle;
        /** ١ للشافعي، ٢ للحنفي. */
        int shadow = 1;
        /** nearest | up | none */
        String rounding = "nearest";
        /** general | ahmer | abyad */
        String shafaq = "general";
        /** إزاحات بالدقائق (يدوية + الطريقة): الفجر، الشروق، الظهر، العصر، المغرب، العشاء. */
        double[] adj = new double[6];

        Params copy() {
            Params p = new Params();
            p.method = method;
            p.fajrAngle = fajrAngle;
            p.ishaAngle = ishaAngle;
            p.ishaInterval = ishaInterval;
            p.maghribAngle = maghribAngle;
            p.shadow = shadow;
            p.rounding = rounding;
            p.shafaq = shafaq;
            p.adj = adj.clone();
            return p;
        }
    }

    /** الأوقات الستة (ms): الفجر، الشروق، الظهر، العصر، المغرب، العشاء. */
    static final String[] KEYS = {"fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"};

    /* ─────────────── تاريخ محلي على طريقة JS ─────────────── */

    /** يوم محلي: سنة، شهر (٠–١١)، يوم، والساعة/الدقيقة/الثانية للنقل بين الأيام. */
    static final class LDate {
        final int y, m, d, hh, mm, ss;

        LDate(int y, int m, int d, int hh, int mm, int ss) {
            Calendar c = Calendar.getInstance();
            c.clear();
            c.setLenient(true);
            c.set(y, m, d, hh, mm, ss);
            this.y = c.get(Calendar.YEAR);
            this.m = c.get(Calendar.MONTH);
            this.d = c.get(Calendar.DAY_OF_MONTH);
            this.hh = c.get(Calendar.HOUR_OF_DAY);
            this.mm = c.get(Calendar.MINUTE);
            this.ss = c.get(Calendar.SECOND);
        }

        static LDate noon(int y, int m, int d) {
            return new LDate(y, m, d, 12, 0, 0);
        }

        LDate plusDays(int n) {
            return new LDate(y, m, d + n, hh, mm, ss);
        }
    }

    /* ─────────────── الواجهة ─────────────── */

    /** مواقيت يوم محلي (ظهره) بالترتيب {@link #KEYS}، أو NaN لوقت غير صالح. */
    static long[] compute(double lat, double lng, LDate date, Params params) {
        double[] t = computeRaw(lat, lng, date, params);
        long[] out = new long[6];
        for (int i = 0; i < 6; i++) out[i] = Double.isNaN(t[i]) ? Long.MIN_VALUE : (long) t[i];
        return out;
    }

    static double[] computeRaw(double lat, double lng, LDate date, Params p) {
        boolean seventh = lat > 48;
        SolarTime solar = new SolarTime(date, lat, lng);

        double dhuhr = new TC(solar.transit).utc(date);
        double sunrise = new TC(solar.sunrise).utc(date);
        double sunset = new TC(solar.sunset).utc(date);
        LDate tomorrow = date.plusDays(1);
        SolarTime tomorrowSolar = new SolarTime(tomorrow, lat, lng);

        if (Double.isNaN(sunrise) || Double.isNaN(sunset) || Double.isNaN(tomorrowSolar.sunrise)) {
            SolarTime[] r = aqrabYaum(lat, lng, date, 1, 1);
            if (r != null) {
                solar = r[0];
                tomorrowSolar = r[1];
            } else {
                solar = new SolarTime(date, lat, lng);
                tomorrowSolar = new SolarTime(date.plusDays(1), lat, lng);
            }
            dhuhr = new TC(solar.transit).utc(date);
            sunrise = new TC(solar.sunrise).utc(date);
            sunset = new TC(solar.sunset).utc(date);
        }

        double asr = new TC(solar.afternoon(p.shadow)).utc(date);
        double tomorrowSunrise = new TC(tomorrowSolar.sunrise).utc(tomorrow);
        double night = (tomorrowSunrise - sunset) / 1000;

        double fajr = new TC(solar.hourAngle(-1 * p.fajrAngle, false)).utc(date);
        boolean msc = "MoonsightingCommittee".equals(p.method);
        if (msc && lat >= 55) fajr = addSeconds(sunrise, -(night / 7));

        double safeFajr;
        if (msc) {
            safeFajr = seasonAdjustedMorningTwilight(lat, dayOfYear(date), date.y, sunrise);
        } else {
            double portion = seventh ? 1.0 / 7 : 1.0 / 2;
            safeFajr = addSeconds(sunrise, -(portion * night));
        }
        if (Double.isNaN(fajr) || safeFajr > fajr) fajr = safeFajr;

        double isha;
        if (p.ishaInterval > 0) {
            isha = addSeconds(sunset, p.ishaInterval * 60.0);
        } else {
            isha = new TC(solar.hourAngle(-1 * p.ishaAngle, true)).utc(date);
            if (msc && lat >= 55) isha = addSeconds(sunset, night / 7);
            double safeIsha;
            if (msc) {
                safeIsha = seasonAdjustedEveningTwilight(lat, dayOfYear(date), date.y, sunset, p.shafaq);
            } else {
                double portion = seventh ? 1.0 / 7 : 1.0 / 2;
                safeIsha = addSeconds(sunset, portion * night);
            }
            if (Double.isNaN(isha) || safeIsha < isha) isha = safeIsha;
        }

        double maghrib = sunset;
        if (p.maghribAngle != 0) {
            double angle = new TC(solar.hourAngle(-1 * p.maghribAngle, true)).utc(date);
            if (sunset < angle && isha > angle) maghrib = angle;
        }

        double[] base = {fajr, sunrise, dhuhr, asr, maghrib, isha};
        double[] out = new double[6];
        for (int i = 0; i < 6; i++) out[i] = rounded(addSeconds(base[i], p.adj[i] * 60), p.rounding);
        return out;
    }

    /* ─────────────── أدوات Date ─────────────── */

    /** {@code new Date(t + s*1000)}: الكسر يُبتر نحو الصفر، وNaN يبقى NaN. */
    static double addSeconds(double t, double seconds) {
        double v = t + seconds * 1000;
        if (Double.isNaN(v) || Double.isInfinite(v)) return Double.NaN;
        return v < 0 ? Math.ceil(v) : Math.floor(v);
    }

    static double rounded(double t, String rounding) {
        if (Double.isNaN(t)) return t;
        long ms = (long) t;
        long sec = Math.floorMod(Math.floorDiv(ms, 1000L), 60L);
        double offset = sec >= 30 ? 60 - sec : -sec;
        if ("up".equals(rounding)) offset = 60 - sec;
        else if ("none".equals(rounding)) offset = 0;
        return addSeconds(t, offset);
    }

    static boolean isLeap(int y) {
        if (y % 4 != 0) return false;
        return y % 100 != 0 || y % 400 == 0;
    }

    static int dayOfYear(LDate d) {
        int[] months = {31, isLeap(d.y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
        int n = 0;
        for (int i = 0; i < d.m; i++) n += months[i];
        return n + d.d;
    }

    /** أيام منذ ١٩٧٠-٠١-٠١ لتاريخ ميلادي (خوارزمية Howard Hinnant). */
    static long daysFromCivil(long y, long m, long d) {
        y -= m <= 2 ? 1 : 0;
        long era = (y >= 0 ? y : y - 399) / 400;
        long yoe = y - era * 400;
        long doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    /** مكوّنات الوقت من ساعات عشرية، كـ TimeComponents في المكتبة. */
    static final class TC {
        final double h, m, s;

        TC(double num) {
            h = Math.floor(num);
            m = Math.floor((num - h) * 60);
            s = Math.floor((num - (h + m / 60)) * 60 * 60);
        }

        /** {@code Date.UTC(y, m, d, h, min, s)}. */
        double utc(LDate d) {
            if (Double.isNaN(h) || Double.isNaN(m) || Double.isNaN(s)) return Double.NaN;
            double day = daysFromCivil(d.y, d.m + 1, d.d);
            return day * 86_400_000d + h * 3_600_000d + m * 60_000d + s * 1000d;
        }
    }

    /* ─────────────── الدائرة القطبية: أقرب يوم ─────────────── */

    private static SolarTime[] aqrabYaum(double lat, double lng, LDate date, int daysAdded, int direction) {
        if (daysAdded > Math.ceil(365 / 2.0)) return null;
        LDate test = date.plusDays(direction * daysAdded);
        LDate tomorrow = test.plusDays(1);
        SolarTime st = new SolarTime(test, lat, lng);
        SolarTime tt = new SolarTime(tomorrow, lat, lng);
        if (!st.valid() || !tt.valid()) {
            return aqrabYaum(lat, lng, date, daysAdded + (direction > 0 ? 0 : 1), -direction);
        }
        return new SolarTime[] {st, tt};
    }

    /* ─────────────── الشفق المعدّل موسمياً (لجنة رؤية الهلال) ─────────────── */

    private static double seasonAdjust(double a, double b, double c, double d, int dyy) {
        if (dyy < 91) return a + ((b - a) / 91.0) * dyy;
        if (dyy < 137) return b + ((c - b) / 46.0) * (dyy - 91);
        if (dyy < 183) return c + ((d - c) / 46.0) * (dyy - 137);
        if (dyy < 229) return d + ((c - d) / 46.0) * (dyy - 183);
        if (dyy < 275) return c + ((b - c) / 46.0) * (dyy - 229);
        return b + ((a - b) / 91.0) * (dyy - 275);
    }

    static double seasonAdjustedMorningTwilight(double lat, int doy, int year, double sunrise) {
        double l = Math.abs(lat);
        double a = 75 + (28.65 / 55.0) * l;
        double b = 75 + (19.44 / 55.0) * l;
        double c = 75 + (32.74 / 55.0) * l;
        double d = 75 + (48.1 / 55.0) * l;
        double adj = seasonAdjust(a, b, c, d, daysSinceSolstice(doy, year, lat));
        return addSeconds(sunrise, jsRound(adj * -60.0));
    }

    static double seasonAdjustedEveningTwilight(double lat, int doy, int year, double sunset, String shafaq) {
        double l = Math.abs(lat);
        double a, b, c, d;
        if ("ahmer".equals(shafaq)) {
            a = 62 + (17.4 / 55.0) * l;
            b = 62 - (7.16 / 55.0) * l;
            c = 62 + (5.12 / 55.0) * l;
            d = 62 + (19.44 / 55.0) * l;
        } else if ("abyad".equals(shafaq)) {
            a = 75 + (25.6 / 55.0) * l;
            b = 75 + (7.16 / 55.0) * l;
            c = 75 + (36.84 / 55.0) * l;
            d = 75 + (81.84 / 55.0) * l;
        } else {
            a = 75 + (25.6 / 55.0) * l;
            b = 75 + (2.05 / 55.0) * l;
            c = 75 - (9.21 / 55.0) * l;
            d = 75 + (6.14 / 55.0) * l;
        }
        double adj = seasonAdjust(a, b, c, d, daysSinceSolstice(doy, year, lat));
        return addSeconds(sunset, jsRound(adj * 60.0));
    }

    /** {@code Math.round} في JS: النصف يُقرَّب نحو +∞. */
    static double jsRound(double v) {
        return Math.floor(v + 0.5);
    }

    static int daysSinceSolstice(int doy, int year, double lat) {
        int northern = 10;
        int southern = isLeap(year) ? 173 : 172;
        int daysInYear = isLeap(year) ? 366 : 365;
        int n;
        if (lat >= 0) {
            n = doy + northern;
            if (n >= daysInYear) n -= daysInYear;
        } else {
            n = doy - southern;
            if (n < 0) n += daysInYear;
        }
        return n;
    }

    /* ─────────────── الزمن الشمسي ─────────────── */

    static final class SolarTime {
        final double lat, lng;
        final Solar solar, prev, next;
        final double approxTransit, transit, sunrise, sunset;

        SolarTime(LDate date, double lat, double lng) {
            this.lat = lat;
            this.lng = lng;
            double jd = julianDay(date.y, date.m + 1, date.d, 0);
            solar = new Solar(jd);
            prev = new Solar(jd - 1);
            next = new Solar(jd + 1);
            double m0 = approximateTransit(lng, solar.sidereal, solar.ra);
            double alt = -50.0 / 60.0;
            approxTransit = m0;
            transit = correctedTransit(m0, lng, solar.sidereal, solar.ra, prev.ra, next.ra);
            sunrise = correctedHourAngle(m0, alt, false);
            sunset = correctedHourAngle(m0, alt, true);
        }

        boolean valid() {
            return !Double.isNaN(sunrise) && !Double.isNaN(sunset);
        }

        double hourAngle(double angle, boolean afterTransit) {
            return correctedHourAngle(approxTransit, angle, afterTransit);
        }

        double afternoon(double shadowLength) {
            double tangent = Math.abs(lat - solar.declination);
            double inverse = shadowLength + Math.tan(rad(tangent));
            double angle = deg(Math.atan(1.0 / inverse));
            return hourAngle(angle, true);
        }

        private double correctedHourAngle(double m0, double h0, boolean afterTransit) {
            double Lw = lng * -1;
            double d2 = solar.declination, d1 = prev.declination, d3 = next.declination;
            double term1 = Math.sin(rad(h0)) - Math.sin(rad(lat)) * Math.sin(rad(d2));
            double term2 = Math.cos(rad(lat)) * Math.cos(rad(d2));
            double H0 = deg(Math.acos(term1 / term2));
            double m = afterTransit ? m0 + H0 / 360 : m0 - H0 / 360;
            double Theta = unwind(solar.sidereal + 360.985647 * m);
            double a = unwind(interpolateAngles(solar.ra, prev.ra, next.ra, m));
            double delta = interpolate(d2, d1, d3, m);
            double H = Theta - Lw - a;
            double h = altitude(lat, delta, H);
            double term3 = h - h0;
            double term4 = 360 * Math.cos(rad(delta)) * Math.cos(rad(lat)) * Math.sin(rad(H));
            double dm = term3 / term4;
            return (m + dm) * 24;
        }
    }

    static final class Solar {
        final double declination, ra, sidereal;

        Solar(double jd) {
            double T = (jd - 2451545.0) / 36525;
            double L0 = meanSolarLongitude(T);
            double Lp = meanLunarLongitude(T);
            double Omega = ascendingLunarNodeLongitude(T);
            double Lambda = rad(apparentSolarLongitude(T, L0));
            double Theta0 = meanSiderealTime(T);
            double dPsi = nutationInLongitude(L0, Lp, Omega);
            double dEpsilon = nutationInObliquity(L0, Lp, Omega);
            double Epsilon0 = meanObliquity(T);
            double EpsApp = rad(apparentObliquity(T, Epsilon0));
            declination = deg(Math.asin(Math.sin(EpsApp) * Math.sin(Lambda)));
            ra = unwind(deg(Math.atan2(Math.cos(EpsApp) * Math.sin(Lambda), Math.cos(Lambda))));
            sidereal = Theta0 + (dPsi * 3600 * Math.cos(rad(Epsilon0 + dEpsilon))) / 3600;
        }
    }

    /* ─────────────── الفلك (Astronomical Algorithms لـ Meeus) ─────────────── */

    static double rad(double d) {
        return (d * Math.PI) / 180.0;
    }

    static double deg(double r) {
        return (r * 180.0) / Math.PI;
    }

    static double normalize(double num, double max) {
        return num - max * Math.floor(num / max);
    }

    static double unwind(double a) {
        return normalize(a, 360.0);
    }

    static double quadrantShift(double a) {
        if (a >= -180 && a <= 180) return a;
        return a - 360 * jsRound(a / 360);
    }

    static double meanSolarLongitude(double T) {
        return unwind(280.4664567 + 36000.76983 * T + 0.0003032 * Math.pow(T, 2));
    }

    static double meanLunarLongitude(double T) {
        return unwind(218.3165 + 481267.8813 * T);
    }

    static double ascendingLunarNodeLongitude(double T) {
        return unwind(125.04452 - 1934.136261 * T + 0.0020708 * Math.pow(T, 2) + Math.pow(T, 3) / 450000);
    }

    static double meanSolarAnomaly(double T) {
        return unwind(357.52911 + 35999.05029 * T - 0.0001537 * Math.pow(T, 2));
    }

    static double equationOfCenter(double T, double M) {
        double Mrad = rad(M);
        double t1 = (1.914602 - 0.004817 * T - 0.000014 * Math.pow(T, 2)) * Math.sin(Mrad);
        double t2 = (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad);
        double t3 = 0.000289 * Math.sin(3 * Mrad);
        return t1 + t2 + t3;
    }

    static double apparentSolarLongitude(double T, double L0) {
        double longitude = L0 + equationOfCenter(T, meanSolarAnomaly(T));
        double Omega = 125.04 - 1934.136 * T;
        return unwind(longitude - 0.00569 - 0.00478 * Math.sin(rad(Omega)));
    }

    static double meanObliquity(double T) {
        return 23.439291 - 0.013004167 * T - 0.0000001639 * Math.pow(T, 2) + 0.0000005036 * Math.pow(T, 3);
    }

    static double apparentObliquity(double T, double e0) {
        double O = 125.04 - 1934.136 * T;
        return e0 + 0.00256 * Math.cos(rad(O));
    }

    static double meanSiderealTime(double T) {
        double JD = T * 36525 + 2451545.0;
        double theta = 280.46061837 + 360.98564736629 * (JD - 2451545)
                + 0.000387933 * Math.pow(T, 2) - Math.pow(T, 3) / 38710000;
        return unwind(theta);
    }

    static double nutationInLongitude(double L0, double Lp, double Omega) {
        double t1 = (-17.2 / 3600) * Math.sin(rad(Omega));
        double t2 = (1.32 / 3600) * Math.sin(2 * rad(L0));
        double t3 = (0.23 / 3600) * Math.sin(2 * rad(Lp));
        double t4 = (0.21 / 3600) * Math.sin(2 * rad(Omega));
        return t1 - t2 - t3 + t4;
    }

    static double nutationInObliquity(double L0, double Lp, double Omega) {
        double t1 = (9.2 / 3600) * Math.cos(rad(Omega));
        double t2 = (0.57 / 3600) * Math.cos(2 * rad(L0));
        double t3 = (0.1 / 3600) * Math.cos(2 * rad(Lp));
        double t4 = (0.09 / 3600) * Math.cos(2 * rad(Omega));
        return t1 + t2 + t3 - t4;
    }

    static double altitude(double phi, double delta, double H) {
        double t1 = Math.sin(rad(phi)) * Math.sin(rad(delta));
        double t2 = Math.cos(rad(phi)) * Math.cos(rad(delta)) * Math.cos(rad(H));
        return deg(Math.asin(t1 + t2));
    }

    static double approximateTransit(double L, double Theta0, double a2) {
        double Lw = L * -1;
        double m0 = normalize((a2 + Lw - Theta0) / 360, 1);
        double expected = normalize((12.0 - L / 15.0) / 24.0, 1);
        if (m0 - expected > 0.5) return m0 - 1.0;
        if (expected - m0 > 0.5) return m0 + 1.0;
        return m0;
    }

    static double correctedTransit(double m0, double L, double Theta0, double a2, double a1, double a3) {
        double Lw = L * -1;
        double Theta = unwind(Theta0 + 360.985647 * m0);
        double a = unwind(interpolateAngles(a2, a1, a3, m0));
        double H = quadrantShift(Theta - Lw - a);
        double dm = H / -360;
        return (m0 + dm) * 24;
    }

    static double interpolate(double y2, double y1, double y3, double n) {
        double a = y2 - y1;
        double b = y3 - y2;
        double c = b - a;
        return y2 + (n / 2) * (a + b + n * c);
    }

    static double interpolateAngles(double y2, double y1, double y3, double n) {
        double a = unwind(y2 - y1);
        double b = unwind(y3 - y2);
        double c = b - a;
        return y2 + (n / 2) * (a + b + n * c);
    }

    static double julianDay(int year, int month, int day, double hours) {
        int Y = month > 2 ? year : year - 1;
        int M = month > 2 ? month : month + 12;
        double D = day + hours / 24;
        int A = Y / 100;
        int B = 2 - A + A / 4;
        int i0 = (int) (365.25 * (Y + 4716));
        int i1 = (int) (30.6001 * (M + 1));
        return i0 + i1 + D + B - 1524.5;
    }
}
