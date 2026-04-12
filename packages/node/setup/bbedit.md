# BBEdit Setup

BBEdit supports language servers natively. This guide walks through setting up `greybel-languageserver` with GreyScript syntax highlighting.

## Prerequisites

Install the language server globally and make sure the npm global bin directory is on your PATH:

```bash
npm install -g greybel-languageserver
```

Add the following to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH=~/.npm-global/bin:$PATH
```

## Required Files

You need two files: a language module plist and an LSP configuration JSON.

### greyscript.plist

Save the following as `greyscript.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>BBEditDocumentType</key>
    <string>CodelessLanguageModule</string>
    <key>BBLMLanguageDisplayName</key>
    <string>GreyScript</string>
    <key>BBLMLanguageCode</key>
    <string>GRSC</string>
    <key>BBLMLanguageID</key>
    <string>greyscript</string>

    <key>BBLMSuffixMap</key>
    <array>
        <dict>
            <key>BBLMLanguageSuffix</key>
            <string>.src</string>
        </dict>
    </array>

    <key>BBLMColorsSyntax</key>
    <true/>
    <key>BBLMUsesLSPSemanticTokensForColoring</key>
    <true/>
    <key>BBLMSupportsLSP</key>
    <true/>
    <key>BBLMIsCaseInsensitive</key>
    <true/>

    <key>Language Features</key>
    <dict>
        <key>Identifier and Keyword Character Class</key>
        <string>a-zA-Z0-9_</string>
        <key>Comment Pattern</key>
        <string>(\/\/.*$)|(\/\*[\s\S]*?\*\/)</string>
        <key>String Pattern</key>
        <string>".*?"</string>
        <key>Open Block Comments</key>
        <string>/*</string>
        <key>Close Block Comments</key>
        <string>*/</string>
        <key>Open Line Comments</key>
        <string>//</string>
        <key>Open Strings 1</key>
        <string>"</string>
        <key>Close Strings 1</key>
        <string>"</string>
        <key>Escape Char in Strings 1</key>
        <string>""</string>
        <key>End-of-line Ends Strings 1</key>
        <false/>
        <key>Open Parameter Lists</key>
        <string>(</string>
        <key>Close Parameter Lists</key>
        <string>)</string>
        <key>Prefix for Functions</key>
        <string>function</string>
    </dict>

    <key>BBLMKeywordList</key>
    <array>
        <string>if</string>
        <string>then</string>
        <string>else</string>
        <string>end</string>
        <string>while</string>
        <string>for</string>
        <string>from</string>
        <string>in</string>
        <string>function</string>
        <string>return</string>
        <string>break</string>
        <string>continue</string>
        <string>repeat</string>
        <string>and</string>
        <string>or</string>
        <string>not</string>
        <string>isa</string>
        <string>new</string>
        <string>true</string>
        <string>false</string>
        <string>null</string>
        <string>self</string>
        <string>super</string>
        <string>locals</string>
        <string>globals</string>
        <string>outer</string>
        <string>params</string>
        <string>list</string>
        <string>map</string>
        <string>number</string>
        <string>string</string>
        <string>funcRef</string>
        <string>#include</string>
        <string>#import</string>
        <string>#envar</string>
        <string>#filename</string>
        <string>#line</string>
        <string>#inject</string>
        <string>debugger</string>
    </array>

    <key>BBLMPredefinedNameList</key>
    <array>
        <string>mail_login</string>
        <string>parent_path</string>
        <string>trim</string>
        <string>hasIndex</string>
        <string>typeof</string>
        <string>get_router</string>
        <string>get_switch</string>
        <string>nslookup</string>
        <string>print</string>
        <string>clear_screen</string>
        <string>active_user</string>
        <string>home_dir</string>
        <string>get_shell</string>
        <string>indexes</string>
        <string>values</string>
        <string>indexOf</string>
        <string>len</string>
        <string>shuffle</string>
        <string>val</string>
        <string>lower</string>
        <string>upper</string>
        <string>sum</string>
        <string>pop</string>
        <string>pull</string>
        <string>push</string>
        <string>sort</string>
        <string>remove</string>
        <string>user_input</string>
        <string>include_lib</string>
        <string>import_code</string>
        <string>exit</string>
        <string>user_mail_address</string>
        <string>user_bank_number</string>
        <string>whois</string>
        <string>wait</string>
        <string>command_info</string>
        <string>program_path</string>
        <string>current_path</string>
        <string>format_columns</string>
        <string>current_date</string>
        <string>is_lan_ip</string>
        <string>is_valid_ip</string>
        <string>bitwise</string>
        <string>abs</string>
        <string>acos</string>
        <string>asin</string>
        <string>atan</string>
        <string>tan</string>
        <string>cos</string>
        <string>code</string>
        <string>char</string>
        <string>sin</string>
        <string>floor</string>
        <string>range</string>
        <string>round</string>
        <string>rnd</string>
        <string>sign</string>
        <string>sqrt</string>
        <string>str</string>
        <string>ceil</string>
        <string>pi</string>
        <string>launch</string>
        <string>launch_path</string>
        <string>slice</string>
        <string>md5</string>
        <string>hash</string>
        <string>time</string>
        <string>bitAnd</string>
        <string>bitOr</string>
        <string>bitXor</string>
        <string>log</string>
        <string>yield</string>
        <string>get_custom_object</string>
        <string>insert</string>
        <string>to_int</string>
        <string>join</string>
        <string>split</string>
        <string>reverse</string>
        <string>replace</string>
        <string>replace_regex</string>
        <string>is_match</string>
        <string>lastIndexOf</string>
        <string>matches</string>
        <string>get_ctf</string>
        <string>check_upgrade</string>
        <string>show</string>
        <string>search</string>
        <string>update</string>
        <string>add_repo</string>
        <string>del_repo</string>
        <string>install</string>
        <string>coin_price</string>
        <string>show_history</string>
        <string>amount_mined</string>
        <string>get_coin</string>
        <string>login_wallet</string>
        <string>create_wallet</string>
        <string>delete_coin</string>
        <string>set_cycle_mining</string>
        <string>get_cycle_mining</string>
        <string>get_reward</string>
        <string>set_reward</string>
        <string>transaction</string>
        <string>create_subwallet</string>
        <string>get_subwallet</string>
        <string>get_subwallets</string>
        <string>set_address</string>
        <string>get_address</string>
        <string>get_mined_coins</string>
        <string>get_ports</string>
        <string>get_name</string>
        <string>lan_ip</string>
        <string>public_ip_pc</string>
        <string>File</string>
        <string>create_folder</string>
        <string>is_network_active</string>
        <string>touch</string>
        <string>show_procs</string>
        <string>network_devices</string>
        <string>change_password</string>
        <string>create_user</string>
        <string>delete_user</string>
        <string>create_group</string>
        <string>delete_group</string>
        <string>groups</string>
        <string>close_program</string>
        <string>wifi_networks</string>
        <string>connect_wifi</string>
        <string>connect_ethernet</string>
        <string>network_gateway</string>
        <string>active_net_card</string>
        <string>aircrack</string>
        <string>airmon</string>
        <string>aireplay</string>
        <string>decipher</string>
        <string>smtp_user_list</string>
        <string>get_description</string>
        <string>get_template</string>
        <string>player_success</string>
        <string>get_creator_name</string>
        <string>get_mail_content</string>
        <string>chmod</string>
        <string>copy</string>
        <string>move</string>
        <string>rename</string>
        <string>path</string>
        <string>is_folder</string>
        <string>parent</string>
        <string>name</string>
        <string>allow_import</string>
        <string>get_content</string>
        <string>set_content</string>
        <string>is_binary</string>
        <string>has_permission</string>
        <string>delete</string>
        <string>get_folders</string>
        <string>get_files</string>
        <string>permissions</string>
        <string>owner</string>
        <string>set_owner</string>
        <string>group</string>
        <string>set_group</string>
        <string>size</string>
        <string>load</string>
        <string>net_use</string>
        <string>rshell_client</string>
        <string>rshell_server</string>
        <string>scan</string>
        <string>scan_address</string>
        <string>sniffer</string>
        <string>overflow</string>
        <string>version</string>
        <string>lib_name</string>
        <string>dump_lib</string>
        <string>get_num_conn_gateway</string>
        <string>get_num_portforward</string>
        <string>get_num_users</string>
        <string>is_any_active_user</string>
        <string>is_root_active_user</string>
        <string>device_ports</string>
        <string>devices_lan_ip</string>
        <string>bssid_name</string>
        <string>essid_name</string>
        <string>firewall_rules</string>
        <string>kernel_version</string>
        <string>local_ip</string>
        <string>public_ip</string>
        <string>used_ports</string>
        <string>ping_port</string>
        <string>port_info</string>
        <string>install_service</string>
        <string>start_service</string>
        <string>stop_service</string>
        <string>host_computer</string>
        <string>start_terminal</string>
        <string>build</string>
        <string>connect_service</string>
        <string>ping</string>
        <string>scp</string>
        <string>get_balance_subwallet</string>
        <string>set_info</string>
        <string>get_info</string>
        <string>delete_subwallet</string>
        <string>get_user</string>
        <string>last_transaction</string>
        <string>mining</string>
        <string>check_password</string>
        <string>wallet_username</string>
        <string>list_coins</string>
        <string>get_balance</string>
        <string>buy_coin</string>
        <string>sell_coin</string>
        <string>get_pending_trade</string>
        <string>cancel_pending_trade</string>
        <string>get_global_offers</string>
        <string>list_global_coins</string>
        <string>show_nodes</string>
        <string>reset_password</string>
        <string>get_pin</string>
        <string>delete_mail</string>
        <string>fetch</string>
        <string>read</string>
        <string>send</string>
        <string>port_number</string>
        <string>is_closed</string>
        <string>get_lan_ip</string>
        <string>reset_password_coin</string>
        <string>reset_ctf_password</string>
        <string>get_coin_name</string>
        <string>symlink</string>
        <string>is_symlink</string>
        <string>is_patched</string>
        <string>debug_tools</string>
        <string>payload</string>
        <string>scan_debuglib</string>
        <string>apply_patch</string>
        <string>unit_testing</string>
        <string>model</string>
        <string>override_settings</string>
        <string>set_alarm</string>
        <string>camera_link_system</string>
        <string>locate_vehicle</string>
        <string>get_credentials_info</string>
        <string>flood_connection</string>
        <string>get_abs_path</string>
        <string>cd</string>
        <string>encrypt</string>
        <string>decrypt</string>
        <string>is_encrypted</string>
        <string>reboot</string>
        <string>masterkey</string>
        <string>masterkey_direct</string>
        <string>restore_network</string>
        <string>meta_info</string>
    </array>

    <key>BBLMLanguageServerInfo</key>
    <dict>
        <key>ServerCommand</key>
        <string>greybel-languageserver</string>
        <key>ServerArguments</key>
        <array>
            <string>--stdio</string>
        </array>
        <key>ServerLanguageID</key>
        <string>greyscript</string>
    </dict>
</dict>
</plist>
```

### greybel.json

Save the following as `greybel.json`:

```json
{
    "initializationOptions": {
      "greybel": {}
    },
    "workspaceConfigurations": {
      "*": {
        "greybel": {
          "fileExtensions": "gs,ms,src",
          "formatter": true,
          "autocomplete": true,
          "hoverdocs": true,
          "diagnostic": true,
          "transpiler": {
              "beautify": {
                  "keepParentheses": true,
                  "indentation": "Tab",
                  "indentationSpaces": 2
              }
          },
          "typeAnalyzer": {
              "strategy": "Workspace"
          }
        }
      }
    }
}
```

## Steps

1. Copy `greyscript.plist` into:

   ```
   ~/Library/Application Support/BBEdit/Language Modules/
   ```

2. Copy `greybel.json` into:

   ```
   ~/Library/Application Support/BBEdit/Language Servers/Configuration/
   ```

3. Open BBEdit and go to **BBEdit > Settings > Application** and enable **Allow sandbox access**.

4. Go to **BBEdit > Settings > Languages > Custom Settings**, click the **+** button, and select **GreyScript**. In the **Server** tab, confirm the LSP is enabled. The server settings should already be populated from the plist file. Change the configuration from **default** to **greybel**.

5. Restart BBEdit.

## Notes

The language server should now be active for `.src` files. Unfortunately BBEdit does not support semantic highlighting via the LSP. Semantic token colors can only be defined through the plist file itself.
