package mobile.absi.hybridtest;

import org.apache.cordova.CordovaChromeClient;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.CordovaWebViewClient;
import android.annotation.TargetApi;
import android.os.Build;
import android.os.Bundle;
import com.salesforce.androidsdk.ui.sfhybrid.SalesforceDroidGapActivity;
import com.salesforce.androidsdk.util.EventsObservable.Event;
import com.salesforce.androidsdk.util.EventsObservable.EventType;
import com.salesforce.androidsdk.util.EventsObservable;
import com.salesforce.androidsdk.util.EventsObserver;
/*
 Don't forget to add 
   <activity 	android:label="@string/app_name"
  				android:name="mobile.absi.hybridtest.NotificationActivity">
   </activity>
 to AndroidManifest, under the existing action.
 */
@TargetApi(Build.VERSION_CODES.HONEYCOMB_MR1) public class NotificationActivity extends SalesforceDroidGapActivity implements EventsObserver{	
	private CordovaWebView webView;
	
	public void onCreate(Bundle savedInstanceState){
		super.onCreate(savedInstanceState);
		EventsObservable.get().registerObserver(this); //Start listening for SDK Events
	}
	
	public void init(CordovaWebView webView, CordovaWebViewClient webViewClient, CordovaChromeClient webChromeClient) {
		webView.clearCache(true);
		super.init(webView, webViewClient, webChromeClient);
		this.webView = webView;		
	}

	@Override
	public void onEvent(Event evt) {
		if(evt.getType().equals(EventType.GapWebViewPageFinished)){
			//First html page loaded, JS function to be called should be loaded by now as well
			boolean wasNotified = getIntent().getBooleanExtra("notified", false);
			Bundle message = getIntent().getBundleExtra("message");
			if(message != null){
				String param = message.getString("param", "");
				String func = message.getString("func", "");
				if(wasNotified){
					System.out.println("NOTIFIED");
					String funcCall = func + "('" + param + "');";
					webView.sendJavascript(funcCall);			
				}
			}
		}		
	}	
}