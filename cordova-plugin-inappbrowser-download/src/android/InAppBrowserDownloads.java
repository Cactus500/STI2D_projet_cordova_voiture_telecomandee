package org.apache.cordova.inappbrowser;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.apache.cordova.CordovaWebView;
import org.json.JSONException;

//Download Files imports
import android.app.DownloadManager;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.widget.Toast;
import android.webkit.WebView;

//Open attachment imports
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.content.ContentResolver;
import android.database.Cursor;
import android.support.v4.content.FileProvider;
import java.io.File;

import static android.content.Context.DOWNLOAD_SERVICE;

//Permissions
import android.content.pm.PackageManager;

public class InAppBrowserDownloads implements DownloadListener {

    InAppBrowser plugin;
    WebView inAppWebView;

    String url;
    String userAgent;
    String contentDisposition;
    String mimetype;
    long contentLength;

    public InAppBrowserDownloads(InAppBrowser plugin, WebView inAppWebView) {
        this.plugin = plugin;
        this.inAppWebView = inAppWebView;
    }

    public void onDownloadStart(String url, String userAgent,
            String contentDisposition, String mimetype,
            long contentLength) {

        InAppBrowserDownloads.this.url = url;
        InAppBrowserDownloads.this.userAgent = userAgent;
        InAppBrowserDownloads.this.contentDisposition = contentDisposition;
        InAppBrowserDownloads.this.mimetype = mimetype;
        InAppBrowserDownloads.this.contentLength = contentLength;

        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT <= 30) {
            if (plugin.cordova.getActivity().checkSelfPermission(
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
                processDownload();
            } else {
                plugin.cordova.requestPermission(InAppBrowserDownloads.this.plugin, 0,
                        android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        } else { // permission is automatically granted on sdk<23 upon installation
            processDownload();
        }
    }

    public void onRequestPermissionResult(int requestCode, String[] permissions,
            int[] grantResults) throws JSONException {
        for (int r : grantResults) {
            if (r == PackageManager.PERMISSION_DENIED) {
                Toast.makeText(plugin.cordova.getActivity().getApplicationContext(),
                        "Error downloading file, missing storage permissions", Toast.LENGTH_LONG).show();
                inAppWebView.evaluateJavascript("document.querySelector('.page-loader').style.display = 'none';", null);
            } else {
                InAppBrowserDownloads.this.processDownload();
            }
        }
    }

    protected void processDownload() {
        final String url = InAppBrowserDownloads.this.url;
        final String cookie = CookieManager.getInstance().getCookie(url);
        String tempfilename = URLUtil.guessFileName(url, InAppBrowserDownloads.this.contentDisposition,
                InAppBrowserDownloads.this.mimetype);
        if (tempfilename.contains("; filename")) {
            tempfilename = tempfilename.substring(0, tempfilename.indexOf("; filename"));
        }
        final String filename = tempfilename;

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        plugin.cordova.getActivity().registerReceiver(attachmentDownloadCompleteReceive,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);

        try {
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); // Notify
                                                                                                            // client
                                                                                                            // once
                                                                                                            // download
                                                                                                            // is
                                                                                                            // completed!
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            request.addRequestHeader("Cookie", cookie);
            request.addRequestHeader("User-Agent", InAppBrowserDownloads.this.userAgent);
            request.addRequestHeader("Referer", url);

            DownloadManager dm = (DownloadManager) plugin.cordova.getActivity().getSystemService(DOWNLOAD_SERVICE);
            dm.enqueue(request);

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT); // This is important!
            intent.addCategory(Intent.CATEGORY_OPENABLE); // CATEGORY.OPENABLE
            intent.setType("*/*");// any application,any extension

            Toast.makeText(plugin.cordova.getActivity().getApplicationContext(), "Downloading file '" + filename + "'",
                    Toast.LENGTH_LONG).show();
            inAppWebView.evaluateJavascript("document.querySelector('.page-loader').style.display = 'none';", null);
        } catch (Exception exception) {
            Toast.makeText(plugin.cordova.getActivity().getApplicationContext(),
                    "Error downloading file, missing storage permissions", Toast.LENGTH_LONG).show();
            exception.printStackTrace();
            inAppWebView.evaluateJavascript("document.querySelector('.page-loader').style.display = 'none';", null);
        }
    }

    /**
     * From https://github.com/digistorm/cordova-plugin-inappbrowser/blob/master/src/android/InAppBrowserDownloads.java
     * Attachment download complete receiver.
     * <p/>
     * 1. Receiver gets called once attachment download completed.
     * 2. Open the downloaded file.
     */
    BroadcastReceiver attachmentDownloadCompleteReceive = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(action)) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, 0);
                openDownloadedAttachment(context, downloadId);
            }
        }
    };

    /**
     * Used to open the downloaded attachment.
     *
     * @param context    Content.
     * @param downloadId Id of the downloaded file to open.
     */
    private void openDownloadedAttachment(final Context context, final long downloadId) {
        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = downloadManager.query(query);
        if (cursor.moveToFirst()) {
            int downloadStatus = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
            String downloadLocalUri = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));
            String downloadMimeType = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_MEDIA_TYPE));
            if ((downloadStatus == DownloadManager.STATUS_SUCCESSFUL) && downloadLocalUri != null) {
                openDownloadedAttachment(context, Uri.parse(downloadLocalUri), downloadMimeType);
            }
        }
        cursor.close();
    }

    /**
     * Used to open the downloaded attachment.
     * <p/>
     * 1. Fire intent to open download file using external application.
     *
     * 2. Note:
     * 2.a. We can't share fileUri directly to other application (because we will
     * get FileUriExposedException from Android7.0).
     * 2.b. Hence we can only share content uri with other application.
     * 2.c. We must have declared FileProvider in manifest.
     * 2.c. Refer -
     * https://developer.android.com/reference/android/support/v4/content/FileProvider.html
     *
     * @param context            Context.
     * @param attachmentUri      Uri of the downloaded attachment to be opened.
     * @param attachmentMimeType MimeType of the downloaded attachment.
     */
    private void openDownloadedAttachment(final Context context, Uri attachmentUri, final String attachmentMimeType) {
        if (attachmentUri != null) {
            try {
                // Get Content Uri.
                if (ContentResolver.SCHEME_FILE.equals(attachmentUri.getScheme())) {
                    // FileUri - Convert it to contentUri.
                    File file = new File(attachmentUri.getPath());
                    attachmentUri = FileProvider.getUriForFile(context, plugin.cordova.getActivity().getPackageName() + ".provider", file);
                }

                Intent openAttachmentIntent = new Intent(Intent.ACTION_VIEW);
                openAttachmentIntent.setDataAndType(attachmentUri, attachmentMimeType);
                openAttachmentIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                context.startActivity(openAttachmentIntent);
                inAppWebView.evaluateJavascript("document.querySelector('.page-loader').style.display = 'none';", null);
            } catch (Exception e) {
                Toast.makeText(context, "Error opening downloaded file", Toast.LENGTH_LONG).show();
                e.printStackTrace();
            }
        }
    }
}
