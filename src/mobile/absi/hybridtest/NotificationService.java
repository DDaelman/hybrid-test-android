package mobile.absi.hybridtest;

import android.app.NotificationManager;
import android.os.Bundle;
import android.support.v4.app.NotificationCompat;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

import com.salesforce.androidsdk.push.PushNotificationInterface;

public class NotificationService implements PushNotificationInterface {
	/*	APEX SAMPLE NOTIFICATION CODE
	 
	   	Messaging.PushNotification msg = new Messaging.PushNotification();
		Map<String, Object> androidPayload = new Map<String, Object>();
		androidPayload.put('title', 'Kone Portal');
		androidPayload.put('msg', 'You\'ve got mail');
		androidPayload.put('func', 'entrypoint');
		androidPayload.put('param', 'Optional parameter');
		
		msg.setPayload(androidPayload );
		
		String userId1 = UserInfo.getUserId();
		Set<String> users = new Set<String>();
		users.add(userId1);
		
		msg.send('TestApp', users);
	 */
	
	//Notifications with the same Id are overwritten on the device 
	//(ie. If it already exists in the tray, no actual notification toast is shown
	//Static variable is temporary fix to illustrate workings
	private static int id = 0;
	@Override
	public void onPushMessageReceived(Bundle message) {
		System.out.println("PUSH NOTIFICATION RECEIVED");
		String title = message.getString("title", "");
		String msgText = message.getString("msg", "");
		
		NotificationCompat.Builder mBuilder = new NotificationCompat.Builder(HybridTestApp.getContext())
	    .setSmallIcon(R.drawable.sf__icon)
	    .setContentTitle(title)
	    .setContentText(msgText);
		
		PackageManager pm = HybridTestApp.getContext().getPackageManager();
		Intent appStartIntent = pm.getLaunchIntentForPackage("mobile.absi.hybridtest");
		if (null != appStartIntent)
		{
			//Run SF app
			//Intent parameters are accessible from the DroidGap-extending class that launches the app
			appStartIntent.putExtra("notified", true);
			appStartIntent.putExtra("message", message);
		}	
		
		PendingIntent pendingIntent =
			    PendingIntent.getActivity(
			    HybridTestApp.getContext(),
			    0,
			    appStartIntent,
			    PendingIntent.FLAG_UPDATE_CURRENT
			);
		
		mBuilder.setContentIntent(pendingIntent);
		NotificationManager mNotifyMgr = (NotificationManager)HybridTestApp.getContext().getSystemService(Context.NOTIFICATION_SERVICE);
		// Builds the notification and issues it.
		mNotifyMgr.notify("KONE-NOTIFICATION", id++, mBuilder.build());		
	}

}
