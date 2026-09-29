/* مواسم منار — أوقات لوحتي «الإمساك والإفطار» و«قيام الليل».
 *
 * دوال نقية تختار اليوم الصحيح من جداول المواقيت الموجودة:
 * - بعد مغرب اليوم يهمّ الصائمَ إمساكُ الغد وإفطاره، لا فجر اليوم الذي مضى.
 * - قبل فجر اليوم (بعد منتصف الليل) الليلةُ الجارية هي ليلة الأمس: من مغرب
 *   أمس إلى فجر اليوم؛ فالثلث الأخير يُحسب من جدول الأمس لا من جدول اليوم. */

export type DayTimes = { fajr: Date; maghrib: Date; isha: Date };

export type FastingPanelTimes = {
  imsak: Date;
  iftar: Date;
  /** الأوقات لصيام الغد (بعد مغرب اليوم). */
  forTomorrow: boolean;
};

export function fastingPanelTimes(
  now: Date,
  today: DayTimes,
  tomorrow: DayTimes,
): FastingPanelTimes {
  if (now.getTime() >= today.maghrib.getTime()) {
    return { imsak: tomorrow.fajr, iftar: tomorrow.maghrib, forTomorrow: true };
  }
  return { imsak: today.fajr, iftar: today.maghrib, forTomorrow: false };
}

export type NightPanelTimes<T extends DayTimes> = {
  /** جدول اليوم الذي بدأت ليلته بمغربه. */
  night: T;
  isha: Date;
  lastThird: Date;
  /** فجر نهاية الليلة. */
  dawn: Date;
  /** الليلة جارية الآن (بعد مغربها وقبل فجرها). */
  ongoing: boolean;
};

/**
 * الليلة المعنيّة الآن: قبل فجر اليوم هي ليلة الأمس، وإلا ليلة اليوم.
 * `lastThirdOf` يحسب بداية الثلث الأخير لليلة التي تبدأ بمغرب الجدول المعطى
 * (في التطبيق: `computeSunnahTimes(t).lastThirdOfTheNight`).
 */
export function nightPanelTimes<T extends DayTimes>(
  now: Date,
  yesterday: T,
  today: T,
  tomorrow: T,
  lastThirdOf: (t: T) => Date,
): NightPanelTimes<T> {
  const t = now.getTime();
  if (t < today.fajr.getTime()) {
    return {
      night: yesterday,
      isha: yesterday.isha,
      lastThird: lastThirdOf(yesterday),
      dawn: today.fajr,
      ongoing: true,
    };
  }
  return {
    night: today,
    isha: today.isha,
    lastThird: lastThirdOf(today),
    dawn: tomorrow.fajr,
    ongoing: t >= today.maghrib.getTime(),
  };
}
