# ساخت APK اندروید OpenLife

ساخت APK با GitHub Actions آماده شده است. نسخه Unity پروژه: **2022.3.62f1**.

## یک‌بار تنظیم مجوز Unity

1. در Unity Hub با حساب Unity وارد شوید و مجوز رایگان Personal را فعال کنید.
2. فایل مجوز Unity را طبق راهنمای GameCI به مقدار متنی `UNITY_LICENSE` تبدیل کنید.
3. در مخزن GitHub به **Settings → Secrets and variables → Actions → New repository secret** بروید.
4. نام secret را دقیقاً `UNITY_LICENSE` بگذارید و متن مجوز را در آن قرار دهید. این مقدار را در فایل‌های مخزن یا پیام‌ها منتشر نکنید.

## اجرای ساخت

1. بروید به تب **Actions** در مخزن.
2. گردش‌کار **Build OpenLife Android APK** را انتخاب کنید.
3. روی **Run workflow** بزنید.
4. پس از موفقیت، در صفحه همان اجرا بخش **Artifacts** فایل `OpenLife-Android-APK` را دانلود کنید؛ داخل ZIP فایل APK قرار دارد.

این گردش‌کار APK را به‌صورت Artifact با مهلت نگهداری ۱۴ روز منتشر می‌کند، نه به‌عنوان فایل Release دائمی. ساخت موفق هنوز به مجوز معتبر Unity و رفع هر خطای احتمالی کامپایل پروژه وابسته است. پس از نصب، بازی باید روی گوشی واقعی آزمایش شود.
