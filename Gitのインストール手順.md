# 「git が定義されない」ときの対処

## 原因
- **Git がインストールされていない**  
  または  
- **インストールしたけど、使っているターミナルに PATH が反映されていない**

---

## 手順1：Git をインストールする

1. 次のページを開く：  
   **https://git-scm.com/download/win**
2. 「Click here to download」などで **64-bit Git for Windows Setup** をダウンロード。
3. ダウンロードした **.exe** を実行。
4. 設定は基本的にそのままで **Next** で進めてOK。  
   特に次の2つはそのままで大丈夫です：
   - **"Git from the command line and also from 3rd-party software"**（これでコマンドから `git` が使えるようになる）
   - **Default editor** はお好みで（変更しなくてOK）
5. 最後まで進めて **Install** → インストール完了後 **Finish**。

---

## 手順2：ターミナルを「やり直す」

インストール直後は、**いま開いているターミナルには Git の PATH がまだ反映されていません。**

### やること（どれかでOK）

**A. Cursor をいったん終了して開き直す**
- Cursor を**完全に終了**（ウィンドウを閉じる）
- もう一度 Cursor を起動
- プロジェクトを開き直して、もう一度ターミナルで `git` を試す

**B. 新しいターミナルを開く**
- Cursor の **ターミナル** で「+」や「新しいターミナル」から **新規ターミナル** を1つ開く
- その**新しいターミナル**で `git --version` を実行

**C. Git Bash を使う（確実な方法）**
- スタートメニューで **「Git Bash」** を検索して起動
- Git Bash は Git 付属のターミナルなので、ここなら `git` が必ず使える
- そこで以下を実行：
  ```bash
  cd "/c/internship/豊田自動織機/ナレッジグラフ用"
  git init
  git add .
  git commit -m "初回"
  # あとはリモートを追加して git push
  ```

---

## 手順3：インストールできたか確認する

**新しいターミナル**（または Git Bash）で：

```powershell
git --version
```

`git version 2.xx.x` のように出ればOKです。  
まだ「認識されません」「定義されません」と出る場合は、**Cursor の再起動**か **Git Bash** を試してください。

---

## それでも「定義されない」場合

- **Cursor のターミナル**が、Git を入れる前の古い PATH を覚えていることがあります。
  - Cursor を**完全終了** → 再起動 → 新規ターミナルで `git --version`
- **PowerShell を管理者で開き直す**必要はありません。通常の Cursor のターミナルか Git Bash で十分です。
