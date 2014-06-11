package mobile.absi.hybridtest;

import org.apache.cordova.api.CordovaPlugin;
import org.apache.cordova.api.CallbackContext;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.ContactsContract;

public class OpenAppPlugin extends CordovaPlugin{
	 @Override
	    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
	     System.out.println("PLUGIN REACHED WITH ARGS : " + args + " AND ACTION : " + action);
		 try{
			 if (action.equals("createcontact")) {
				 JSONObject params = args.getJSONObject(0);
				 String fName = params.getString("firstname");
				 String lName = params.getString("lastname");
				 String phone = params.getString("phone");
				 String comp = params.getString("company");
	             this.createContact(fName + " " + lName, phone, comp);
	            return true;
			 }
			 if(action.equals("displaycontact")){
				 JSONObject params = args.getJSONObject(0);
				 String id = params.getString("id");
				 this.displayContact(id);
				 return true;
			 }
		 }catch(Exception e){
			 System.out.println(e);
		 }
	        return false;
	    }

	    private void createContact(String fullname, String phone, String company) {
	    	Context context=this.cordova.getActivity().getApplicationContext();
	    	Intent i = new Intent(Intent.ACTION_INSERT);
	    	i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); 
	        i.setType(ContactsContract.Contacts.CONTENT_TYPE);
	        i.putExtra(ContactsContract.Intents.Insert.NAME, fullname);
	        i.putExtra(ContactsContract.Intents.Insert.PHONE, phone);
	        i.putExtra(ContactsContract.Intents.Insert.COMPANY, company);
	        context.startActivity(i);
	    }
	    
	    private void displayContact(String id){
	    	System.out.println("PLUGIN -- DISPLAY CONTACT " + id);  
	    	Context context=this.cordova.getActivity().getApplicationContext();
	    	Intent i = new Intent(Intent.ACTION_VIEW);
	    	i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); 
	    	i.addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK); 
	    	Uri uri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, String.valueOf(id));
	    	i.setData(uri);	
	    	context.startActivity(i);
	    }
}
