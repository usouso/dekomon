[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProjectPath)
$ErrorActionPreference='Stop'
$utf8=[System.Text.UTF8Encoding]::new($false)
$canonicalRoot=$PSScriptRoot
$projectRoot=[IO.Path]::GetFullPath($ProjectPath)
if(-not (Test-Path -LiteralPath $projectRoot -PathType Container)){throw 'ProjectPath must be an existing authorized project folder'}
$docDir=Join-Path $projectRoot 'docs\game-development'
$resolvedDoc=[IO.Path]::GetFullPath($docDir)
if(-not $resolvedDoc.StartsWith($projectRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Documentation target escaped project'}
$names=@('GAME-DEVELOPMENT-STANDARD.md','HANDOFF-TEMPLATE.md','REVIEW-PROCEDURE.md')
# Preflight all targets before any project mutation.
foreach($docName in $names){
 $src=Join-Path $canonicalRoot $docName
 $dst=Join-Path $docDir $docName
 if(-not (Test-Path -LiteralPath $src -PathType Leaf)){throw "Missing canonical document: $docName"}
 if((Test-Path -LiteralPath $dst) -and ((Get-FileHash -LiteralPath $src).Hash -ne (Get-FileHash -LiteralPath $dst).Hash)){throw "Existing different document; preserving it: $dst"}
}
New-Item -ItemType Directory -Path $docDir -Force | Out-Null
foreach($docName in $names){Copy-Item -LiteralPath (Join-Path $canonicalRoot $docName) -Destination (Join-Path $docDir $docName) -Force}
$marker='## Game development standard entry v1.1'
$block=@'

## Game development standard entry v1.1
ゲーム作業の最初に [全ゲーム共通標準](docs/game-development/GAME-DEVELOPMENT-STANDARD.md) を読む。
[独立レビュー手順](docs/game-development/REVIEW-PROCEDURE.md) と [引継ぎ書式](docs/game-development/HANDOFF-TEMPLATE.md) を使う。
dot が制作担当と異なる独立担当を指定する。独立担当が未確保なら完了にしない。担当は読んだ版・パス・時刻を返す。
同時に動いている制作・LOCK・対象commitを確認してから着手する。画面と通常入力はコードレビューとは別に実証する。
'@
foreach($entryName in @('AGENTS.md','CLAUDE.md')){
 $entryPath=Join-Path $projectRoot $entryName
 $before=if(Test-Path -LiteralPath $entryPath){[IO.File]::ReadAllText($entryPath)}else{''}
 if(-not $before.Contains($marker)){[IO.File]::WriteAllText($entryPath,$before+$block,$utf8)}
}
[pscustomobject]@{ProjectPath=$projectRoot;CanonicalRoot=$canonicalRoot;Version='1.1';Docs=$names;EntryPoints=@('AGENTS.md','CLAUDE.md')} | ConvertTo-Json -Depth 3
