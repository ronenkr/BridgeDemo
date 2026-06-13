// Copyright 2014. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class BridgeDemoEditorTarget : TargetRules
{
	public BridgeDemoEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;

        ExtraModuleNames.AddRange(new string[] { "BridgeDemo" });
    }
}
