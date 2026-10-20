param([string]$LayoutPath = (Join-Path $PSScriptRoot 'presentation-layout.json'))

$ErrorActionPreference = 'Stop'
$deck = Get-Content -LiteralPath $LayoutPath -Raw -Encoding UTF8 | ConvertFrom-Json
$outputDir = $PSScriptRoot
$pptxPath = Join-Path $outputDir 'module-builder-stakeholders.pptx'
$pdfPath = Join-Path $outputDir 'module-builder-stakeholders.pdf'
$previewDir = Join-Path $outputDir 'previews'
New-Item -ItemType Directory -Path $previewDir -Force | Out-Null
$overflow = [System.Collections.Generic.List[string]]::new()

function Convert-Color([string]$Hex) {
    $r = [Convert]::ToInt32($Hex.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($Hex.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($Hex.Substring(4, 2), 16)
    return $r + 256 * $g + 65536 * $b
}

$powerPoint = $null
$presentation = $null
try {
    # Do not display or close the user's existing presentations.
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Add(0)
    $presentation.PageSetup.SlideWidth = [single]$deck.width
    $presentation.PageSetup.SlideHeight = [single]$deck.height

    $slideIndex = 0
    foreach ($slideData in $deck.slides) {
        $slideIndex++
        $slide = $presentation.Slides.Add($slideIndex, 12)
        $slide.FollowMasterBackground = 0
        $slide.Background.Fill.Solid()
        $slide.Background.Fill.ForeColor.RGB = Convert-Color $slideData.background
        foreach ($element in $slideData.elements) {
            if ($element.kind -eq 'line') {
                $shape = $slide.Shapes.AddConnector(1, [single]$element.x1, [single]$element.y1, [single]$element.x2, [single]$element.y2)
                $shape.Line.ForeColor.RGB = Convert-Color $element.color
                $shape.Line.Weight = 1.6
                $shape.Line.EndArrowheadStyle = 3
                continue
            }
            if ($element.kind -eq 'rect') {
                $shapeType = if ($element.rounded) { 5 } else { 1 }
                $shape = $slide.Shapes.AddShape($shapeType, [single]$element.x, [single]$element.y, [single]$element.w, [single]$element.h)
                if ($element.rounded) { $shape.Adjustments.Item(1) = 0.08 }
                $shape.Fill.Solid()
                $shape.Fill.ForeColor.RGB = Convert-Color $element.fill
                if ($element.border) {
                    $shape.Line.ForeColor.RGB = Convert-Color $element.border
                    $shape.Line.Weight = 0.7
                    if ($element.dashed) { $shape.Line.DashStyle = 4 }
                } else { $shape.Line.Visible = 0 }
                continue
            }
            $shape = $slide.Shapes.AddTextbox(1, [single]$element.x, [single]$element.y, [single]$element.w, [single]$element.h)
            $shape.Name = "Slide-$slideIndex-text-$($slide.Shapes.Count)"
            $shape.Line.Visible = 0
            $shape.Fill.Visible = 0
            $frame = $shape.TextFrame
            $frame.MarginLeft = 0
            $frame.MarginRight = 0
            $frame.MarginTop = 0
            $frame.MarginBottom = 0
            $frame.WordWrap = -1
            $frame.AutoSize = 0
            $range = $frame.TextRange
            $range.Text = [string]$element.text
            $range.Font.Name = 'Aptos'
            $range.Font.Size = [single]$element.size
            $range.Font.Bold = if ($element.bold) { -1 } else { 0 }
            $range.Font.Color.RGB = Convert-Color $element.color
            $range.ParagraphFormat.SpaceBefore = 0
            $range.ParagraphFormat.SpaceAfter = if ($element.bold -or $element.size -lt 15) { 0 } else { 5 }
            $range.ParagraphFormat.Bullet.Visible = 0
            $shape.TextFrame2.AutoSize = 0
            $frame.AutoSize = 0
            $shape.LockAspectRatio = 0
            $shape.Left = [single]$element.x
            $shape.Top = [single]$element.y
            $shape.Width = [single]$element.w
            $shape.Height = [single]$element.h
            if ($element.link) { $shape.ActionSettings.Item(1).Hyperlink.Address = $element.link }

            # Measure native PowerPoint text and adjust only when needed.
            $minimumSize = if ($element.size -ge 16) { 15.5 } else { [single]$element.size }
            while (($range.BoundHeight -gt ($shape.Height + 1)) -and ($range.Font.Size -gt $minimumSize)) {
                $range.Font.Size = [single][Math]::Max($minimumSize, ($range.Font.Size - 0.5))
            }
            if ($range.BoundHeight -gt ($shape.Height + 2)) {
                $overflow.Add("Slide ${slideIndex}: $($element.text.Replace("`n", ' / ')) [height=$($range.BoundHeight), box=$($shape.Height)]")
            }
        }
        $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = [string]$slideData.notes
    }

    $presentation.SaveAs($pptxPath, 24)
    $presentation.SaveAs($pdfPath, 32)
    foreach ($slide in $presentation.Slides) {
        $slide.Export((Join-Path $previewDir ('slide-{0:d2}.png' -f $slide.SlideIndex)), 'PNG', 1280, 720)
    }

    # Contact sheet is a preview only; the actual presentation retains editable shapes/text.
    Add-Type -AssemblyName System.Drawing
    $columns = 4
    $rows = [int][Math]::Ceiling($presentation.Slides.Count / $columns)
    $cellWidth = 400
    $cellHeight = 244
    $sheet = [System.Drawing.Bitmap]::new($columns * $cellWidth, $rows * $cellHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#E5E8E5'))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $labelFont = [System.Drawing.Font]::new('Arial', 11)
    for ($index = 1; $index -le $presentation.Slides.Count; $index++) {
        $sourcePath = Join-Path $previewDir ('slide-{0:d2}.png' -f $index)
        $preview = [System.Drawing.Image]::FromFile($sourcePath)
        $x = (($index - 1) % $columns) * $cellWidth + 8
        $y = [int][Math]::Floor(($index - 1) / $columns) * $cellHeight + 8
        $graphics.DrawImage($preview, $x, $y, 384, 216)
        $graphics.DrawString(('Slide {0:d2}' -f $index), $labelFont, [System.Drawing.Brushes]::Black, [single]$x, [single]($y + 219))
        $preview.Dispose()
    }
    $sheet.Save((Join-Path $outputDir 'slide-overview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $labelFont.Dispose()
    $graphics.Dispose()
    $sheet.Dispose()

    $validation = [ordered]@{ slides = $presentation.Slides.Count; textOverflow = @($overflow.ToArray()); pptx = $pptxPath; pdf = $pdfPath }
    $validation | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir 'validation.json') -Encoding UTF8
    Write-Output ($validation | ConvertTo-Json -Depth 4)
} finally {
    if ($null -ne $presentation) { $presentation.Close() }
    # Quit only if this automation session has no other presentation open.
    if ($null -ne $powerPoint) {
        if ($powerPoint.Presentations.Count -eq 0) { $powerPoint.Quit() }
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
    }
}
