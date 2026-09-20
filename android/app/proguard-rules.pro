# Manar — R8 rules.
#
# Capacitor discovers plugins reflectively, so plugin classes and their
# @PluginMethod members must survive shrinking, otherwise the JS bridge fails at
# runtime with "plugin not implemented".

-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# Manar's own native stack is referenced from the manifest and from JS by name.
-keep class app.manar.islamic.** { *; }

# Plugins exchange data as org.json values.
-keep class org.json.** { *; }

# WebView JS interfaces.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Cordova compatibility layer shipped by Capacitor.
-keep class org.apache.cordova.** { *; }

-dontwarn org.apache.cordova.**
-dontwarn com.getcapacitor.**
