param([string]$LayoutPath = (Join-Path $PSScriptRoot 'presentation-layout.json'))

$ErrorActionPreference = 'Stop'
$deckData = Get-Content -LiteralPath $LayoutPath -Raw -Encoding UTF8 | ConvertFrom-Json
$previewDir = Join-Path $PSScriptRoot 'previews'
New-Item -ItemType Directory -Path $previewDir -Force | Out-Null
$overflow = [System.Collections.Generic.List[string]]::new()
$actualFonts = [System.Collections.Generic.List[object]]::new()
function Convert-Color([string]$Hex) {
    return [Convert]::ToInt32($Hex.Substring(0,2),16) + 256*[Convert]::ToInt32($Hex.Substring(2,2),16) + 65536*[Convert]::ToInt32($Hex.Substring(4,2),16)
}

$powerPoint = $null
$presentation = $null
try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Add(0)
    $presentation.PageSetup.SlideWidth = [single]$deckData.width
    $presentation.PageSetup.SlideHeight = [single]$deckData.height
    $index = 0
    foreach ($slideData in $deckData.slides) {
        $index++
        Write-Output "Building slide $index of $($deckData.slides.Count)"
        $slide = $presentation.Slides.Add($index, 12)
        $slide.FollowMasterBackground = 0
        $slide.Background.Fill.Solid()
        $slide.Background.Fill.ForeColor.RGB = Convert-Color $slideData.background
        foreach ($element in $slideData.elements) {
            if ($element.kind -eq 'image') {
                $picture = $slide.Shapes.AddPicture([string]$element.path, 0, -1, [single]$element.x, [single]$element.y, [single]$element.w, [single]$element.h)
                $picture.AlternativeText = "Demo screenshot: $($element.source)"
                continue
            }
            if ($element.kind -eq 'rect') {
                $shape = $slide.Shapes.AddShape(1, [single]$element.x, [single]$element.y, [single]$element.w, [single]$element.h)
                $shape.Fill.Solid()
                $shape.Fill.ForeColor.RGB = Convert-Color $element.fill
                if ($element.border) {
                    $shape.Line.ForeColor.RGB = Convert-Color $element.border
                    $shape.Line.Weight = 0.8
                } else { $shape.Line.Visible = 0 }
                continue
            }
            $shape = $slide.Shapes.AddTextbox(1, [single]$element.x, [single]$element.y, [single]$element.w, [single]$element.h)
            $shape.Line.Visible = 0
            $shape.Fill.Visible = 0
            $frame = $shape.TextFrame
            $frame.MarginLeft = 0; $frame.MarginRight = 0; $frame.MarginTop = 0; $frame.MarginBottom = 0
            $frame.WordWrap = -1; $frame.AutoSize = 0
            $range = $frame.TextRange
            $range.Text = [string]$element.text
            $range.Font.Name = 'Aptos'
            $range.Font.Size = [single]$element.size
            $range.Font.Bold = if ($element.bold) { -1 } else { 0 }
            $range.Font.Color.RGB = Convert-Color $element.color
            $range.ParagraphFormat.SpaceBefore = 0; $range.ParagraphFormat.SpaceAfter = 0
            $range.ParagraphFormat.Bullet.Visible = 0
            $shape.TextFrame2.AutoSize = 0
            $frame.AutoSize = 0
            $shape.LockAspectRatio = 0
            $shape.Left = [single]$element.x
            $shape.Top = [single]$element.y
            $shape.Width = [single]$element.w
            $shape.Height = [single]$element.h
            $minimum = if ($element.size -ge 18) { [Math]::Ceiling([Math]::Max(16, $element.size * 0.78)*2)/2 } else { [single]$element.size }
            $resizeAttempts = 0
            while ($range.BoundHeight -gt ($shape.Height + 1) -and $range.Font.Size -gt $minimum -and $resizeAttempts -lt 80) {
                $resizeAttempts++
                $range.Font.Size = [single][Math]::Max($minimum, $range.Font.Size - 0.5)
            }
            if ($range.BoundHeight -gt ($shape.Height + 2)) {
                $overflow.Add("Slide ${index}: $($element.text) [text=$($range.BoundHeight), box=$($shape.Height)]")
            }
            if ($range.Font.Size -lt $element.size) {
                $actualFonts.Add(@{ slide=$index; original=$element.size; actual=$range.Font.Size; text=$element.text })
            }
        }
        $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = [string]$slideData.notes
    }
    $pptx = Join-Path $PSScriptRoot 'module-builder-user-journey.pptx'
    $pdf = Join-Path $PSScriptRoot 'module-builder-user-journey.pdf'
    $presentation.SaveAs($pptx, 24)
    $presentation.SaveAs($pdf, 32)
    foreach ($slide in $presentation.Slides) {
        $slide.Export((Join-Path $previewDir ('slide-{0:d2}.png' -f $slide.SlideIndex)), 'PNG', 1600, 900)
    }
    Add-Type -AssemblyName System.Drawing
    $columns=4; $cellWidth=400; $cellHeight=246
    $rows=[int][Math]::Ceiling($presentation.Slides.Count/$columns)
    $sheet=[System.Drawing.Bitmap]::new($columns*$cellWidth,$rows*$cellHeight)
    $graphics=[System.Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#E7E3EF'))
    $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $font=[System.Drawing.Font]::new('Arial',10)
    for($i=1;$i -le $presentation.Slides.Count;$i++) {
        $preview=[System.Drawing.Image]::FromFile((Join-Path $previewDir ('slide-{0:d2}.png' -f $i)))
        $x=(($i-1)%$columns)*$cellWidth+8; $y=[int][Math]::Floor(($i-1)/$columns)*$cellHeight+8
        $graphics.DrawImage($preview,$x,$y,384,216)
        $graphics.DrawString(('Slide {0:d2}' -f $i),$font,[System.Drawing.Brushes]::Black,[single]$x,[single]($y+220))
        $preview.Dispose()
    }
    $sheet.Save((Join-Path $PSScriptRoot 'slide-overview.png'),[System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose(); $graphics.Dispose(); $sheet.Dispose()
    $validation=@{ slides=$presentation.Slides.Count; textOverflow=@($overflow.ToArray()); reducedFonts=@($actualFonts.ToArray()); pptx=$pptx; pdf=$pdf }
    $validation | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'validation.json') -Encoding UTF8
    Write-Output "Exported $($presentation.Slides.Count) slides; text overflow: $($overflow.Count); adjusted text boxes: $($actualFonts.Count)."
    Write-Output "PowerPoint: $pptx"
    Write-Output "PDF: $pdf"
} finally {
    if ($null -ne $presentation) { $presentation.Close() }
    if ($null -ne $powerPoint) {
        if ($powerPoint.Presentations.Count -eq 0) { $powerPoint.Quit() }
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
    }
}
