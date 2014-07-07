package mobile.absi.hybridtest;

import org.apache.cordova.api.CallbackContext;
import org.apache.cordova.api.CordovaPlugin;
import org.apache.cordova.api.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.Context;
import android.content.SharedPreferences;

public class PreferencesPlugin extends CordovaPlugin {
	 @Override
	 public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
		 if(action.equals("store")){
			 JSONObject params = args.getJSONObject(0);
			 if(!this.storeSetting(params.getString("name"), params.getString("value"))){
				 PluginResult pluginResult = new PluginResult(PluginResult.Status.ERROR, "Setting not saved");
				 callbackContext.sendPluginResult(pluginResult);
			 }
		 }
		 if(action.equals("read_or_create")){
			 String result = "";
			 JSONObject params = args.getJSONObject(0);
			 this.readSetting(params.getString("name"), params.getString("value"));
			 PluginResult pluginResult = new PluginResult(PluginResult.Status.OK, result);
			 callbackContext.sendPluginResult(pluginResult);
		 }
		 return true;
	 }
	 
	 private boolean storeSetting(String name,  String value){
		Context ctx  = this.cordova.getActivity().getApplicationContext();
		SharedPreferences preferences = ctx.getSharedPreferences("MyPreferences", Context.MODE_PRIVATE);  
		SharedPreferences.Editor editor = preferences.edit();
		editor.putString(name, value);
		return editor.commit();		 
	 }
	 
	 private String readSetting(String name, String value){
		 Context ctx  = this.cordova.getActivity().getApplicationContext();
		 SharedPreferences preferences = ctx.getSharedPreferences("MyPreferences", Context.MODE_PRIVATE);
		 if(preferences.contains(name)){
			 return preferences.getString(name, "");
		 }else{
			 storeSetting(name, value);
			 return value;
		 }
	 }
}
